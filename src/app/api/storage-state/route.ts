import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { neon } from '@neondatabase/serverless';
import {
  DEFAULT_REPOSITORY_ID,
  INITIAL_AUDIT_LOGS,
  INITIAL_FILES,
  INITIAL_FOLDERS,
  INITIAL_HERO_CHANGELOG,
  INITIAL_REPOSITORIES,
  INITIAL_USERS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_COMMENTS,
} from '../../../lib/db';
import { canEditRepository, canManagePlatform } from '../../../lib/authorization';
import { VantorFile, VantorFolder, VantorRepository, VantorUser, ShareLink, Announcement, FileComment } from '../../../lib/types';

const STATE_ID = 'default';

const defaultState = {
  files: INITIAL_FILES as VantorFile[],
  folders: INITIAL_FOLDERS as VantorFolder[],
  repositories: (INITIAL_REPOSITORIES.length > 0 ? INITIAL_REPOSITORIES : [{
    id: DEFAULT_REPOSITORY_ID,
    name: 'Vantor Root Repository',
    description: 'Default root storage workspace',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'System Operator',
    assignedUserIds: [],
    assignedRoles: ['admin', 'manager', 'member', 'viewer'],
  }]) as VantorRepository[],
  changelog: INITIAL_HERO_CHANGELOG,
  changelogs: {} as Record<string, any>,
  auditLogs: INITIAL_AUDIT_LOGS as any[],
  users: INITIAL_USERS as VantorUser[],
  announcements: INITIAL_ANNOUNCEMENTS as Announcement[],
  settings: {
    theme: 'dark',
  },
  shares: [] as ShareLink[],
  comments: INITIAL_COMMENTS as FileComment[],
};

type StorageState = typeof defaultState;

const getUserRole = (state: StorageState, userId: string) => {
  return state.users.find((user) => user.id === userId)?.role || 'admin';
};

const isSelfRegistrationPatch = (state: StorageState, patch: Partial<StorageState>, userId: string) => {
  if (!patch.users || patch.files || patch.folders || patch.repositories || patch.changelog || patch.changelogs || patch.auditLogs || patch.announcements) {
    return false;
  }

  if (state.users.some((managedUser) => managedUser.id === userId)) return false;

  const previousUserIds = new Set(state.users.map((managedUser) => managedUser.id));
  const newUser = patch.users.find((managedUser) => managedUser.id === userId);

  return Boolean(newUser && patch.users.some((managedUser) => managedUser.id === userId));
};

const getRepositoryId = (item: Pick<VantorFile | VantorFolder, 'repositoryId'>) => {
  return item.repositoryId || DEFAULT_REPOSITORY_ID;
};

const hasPermissionPolicyChange = (
  current: VantorFile | VantorFolder | undefined,
  next: VantorFile | VantorFolder
) => {
  if (!current) return false;
  return current.permissionLevel !== next.permissionLevel ||
    JSON.stringify(current.allowedRoles || []) !== JSON.stringify(next.allowedRoles || []);
};

const isDownloadCountOnlyChange = (
  current: VantorFile | VantorFolder | undefined,
  next: VantorFile | VantorFolder
) => {
  if (!current || !('downloadCount' in current) || !('downloadCount' in next)) return false;

  const { downloadCount: _currentDownloadCount, ...currentWithoutDownloads } = current;
  const { downloadCount: _nextDownloadCount, ...nextWithoutDownloads } = next;

  return JSON.stringify(currentWithoutDownloads) === JSON.stringify(nextWithoutDownloads) &&
    next.downloadCount >= current.downloadCount;
};

const validateContentPatch = (
  previousItems: Array<VantorFile | VantorFolder>,
  nextItems: Array<VantorFile | VantorFolder>,
  repositories: VantorRepository[],
  role: VantorUser['role'],
  userId: string
) => {
  if (canManagePlatform(role)) return null;

  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  const nextById = new Map(nextItems.map((item) => [item.id, item]));

  for (const previousItem of previousItems) {
    if (!nextById.has(previousItem.id)) {
      return 'Only administrators can delete files or folders.';
    }
  }

  for (const nextItem of nextItems) {
    const previousItem = previousById.get(nextItem.id);
    if (previousItem && JSON.stringify(previousItem) === JSON.stringify(nextItem)) continue;
    if (isDownloadCountOnlyChange(previousItem, nextItem)) continue;

    if (hasPermissionPolicyChange(previousItem, nextItem)) {
      return 'Only administrators can manage item permissions.';
    }

    const repositoryId = getRepositoryId(nextItem);
    if (repositoryId === DEFAULT_REPOSITORY_ID || repositoryId === 'repo-default') {
      if (role === 'viewer') return 'Viewers do not have write access.';
      continue;
    }

    const repository = repositories.find((candidate) => candidate.id === repositoryId);
    if (repository && !canEditRepository(role, userId, repository)) {
      return 'You do not have editing access to this repository.';
    }
  }

  return null;
};

const validateRepositoryPatch = (
  previousRepositories: VantorRepository[],
  nextRepositories: VantorRepository[],
  role: VantorUser['role'],
  userId: string
) => {
  if (canManagePlatform(role)) return null;

  if (previousRepositories.length !== nextRepositories.length) {
    if (previousRepositories.length === 0) return null;
    return 'Only administrators can create or delete repositories.';
  }

  const previousById = new Map(previousRepositories.map((repository) => [repository.id, repository]));
  for (const nextRepository of nextRepositories) {
    const previousRepository = previousById.get(nextRepository.id);
    if (!previousRepository) continue;

    const isOnlyTimestampBump =
      previousRepository.id === nextRepository.id &&
      previousRepository.name === nextRepository.name &&
      previousRepository.description === nextRepository.description;

    if (isOnlyTimestampBump) continue;

    if (!canEditRepository(role, userId, previousRepository)) {
      return 'You do not have editing access to this repository.';
    }
  }

  return null;
};

const validatePatch = (state: StorageState, patch: Partial<StorageState>, userId: string) => {
  if (isSelfRegistrationPatch(state, patch, userId)) return null;

  const role = getUserRole(state, userId);
  const isAdmin = canManagePlatform(role);

  if (!isAdmin && (patch.users || patch.changelog || patch.changelogs || patch.announcements)) {
    return 'Only administrators can manage users, permissions, announcements, and platform metadata.';
  }

  if (!isAdmin && patch.auditLogs) {
    const previousLogIds = new Set((state.auditLogs || []).map((log) => log.id));
    const removedAuditLog = (state.auditLogs || []).some((log) => !patch.auditLogs?.some((nextLog) => nextLog.id === log.id));
    if (removedAuditLog) {
      return 'Only administrators can delete security logs.';
    }
  }

  if (patch.repositories) {
    const error = validateRepositoryPatch(state.repositories || [], patch.repositories, role, userId);
    if (error) return error;
  }

  const repositories = patch.repositories || state.repositories || [];

  if (patch.files) {
    const error = validateContentPatch(state.files || [], patch.files, repositories, role, userId);
    if (error) return error;
  }

  if (patch.folders) {
    const error = validateContentPatch(state.folders || [], patch.folders, repositories, role, userId);
    if (error) return error;
  }

  return null;
};

const getSql = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  return neon(process.env.DATABASE_URL);
};

const ensureState = async () => {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS vantor_app_state (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    INSERT INTO vantor_app_state (id, data)
    VALUES (${STATE_ID}, ${JSON.stringify(defaultState)}::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;

  return sql;
};

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = await ensureState();
    const rows = await sql`
      SELECT data
      FROM vantor_app_state
      WHERE id = ${STATE_ID}
      LIMIT 1
    `;

    return NextResponse.json(rows[0]?.data ?? defaultState);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load storage state.' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function PATCH(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = await ensureState();
    const patch = await request.json();

    // Persist file blobs to database & sanitize large base64 contents from JSON state
    if (Array.isArray(patch.files)) {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS vantor_file_blobs (
            file_id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            data BYTEA NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;

        for (let i = 0; i < patch.files.length; i++) {
          const file = patch.files[i] as VantorFile;
          if (file.content && file.content.startsWith('data:') && !file.url) {
            try {
              const parts = file.content.split(',');
              const mimeMatch = parts[0].match(/data:(.*?);/);
              const mimeType = mimeMatch ? mimeMatch[1] : file.mimeType || 'application/octet-stream';
              const base64Data = parts[1] || parts[0];
              const buffer = Buffer.from(base64Data, 'base64');
              const hexData = `\\x${buffer.toString('hex')}`;

              await sql`
                INSERT INTO vantor_file_blobs (file_id, filename, mime_type, data)
                VALUES (${file.id}, ${file.name}, ${mimeType}, ${hexData}::bytea)
                ON CONFLICT (file_id) DO UPDATE SET
                  filename = EXCLUDED.filename,
                  mime_type = EXCLUDED.mime_type,
                  data = EXCLUDED.data,
                  created_at = NOW()
              `;

              file.url = `/api/public/files/${file.id}`;
            } catch (blobErr) {
              console.warn('Failed to auto-save file blob during PATCH:', blobErr);
            }
          }

          if (file.content && file.content.length > 200000 && file.content.startsWith('data:')) {
            delete file.content;
          }
        }
      } catch (tableErr) {
        console.warn('vantor_file_blobs setup/save error:', tableErr);
      }
    }

    const currentRows = await sql`
      SELECT data
      FROM vantor_app_state
      WHERE id = ${STATE_ID}
      LIMIT 1
    `;
    const currentState = (currentRows[0]?.data ?? defaultState) as StorageState;
    const authorizationError = validatePatch(currentState, patch, userId);

    if (authorizationError) {
      return NextResponse.json({ error: authorizationError }, { status: 403 });
    }

    const rows = await sql`
      UPDATE vantor_app_state
      SET data = data || ${JSON.stringify(patch)}::jsonb,
          updated_at = NOW()
      WHERE id = ${STATE_ID}
      RETURNING data
    `;

    return NextResponse.json(rows[0]?.data ?? defaultState);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update storage state.' },
      { status: 500 }
    );
  }
}
