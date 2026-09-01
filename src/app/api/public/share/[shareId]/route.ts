import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { ShareLink, VantorFile, VantorFolder } from '../../../../../lib/types';

const STATE_ID = 'default';

const getSql = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }
  return neon(process.env.DATABASE_URL);
};

// Check recursively if folderId is a descendant of ancestorId
const isDescendant = (folderId: string, ancestorId: string, folders: VantorFolder[]): boolean => {
  let currentId: string | null = folderId;
  while (currentId) {
    const currentFolder = folders.find(f => f.id === currentId);
    if (!currentFolder) break;
    if (currentFolder.parentId === ancestorId) return true;
    currentId = currentFolder.parentId;
  }
  return false;
};

export async function GET(
  request: Request,
  props: { params: Promise<{ shareId: string }> }
) {
  const params = await props.params;
  const { shareId } = params;
  const { searchParams } = new URL(request.url);
  const passwordQuery = searchParams.get('password') || undefined;
  const subfolderId = searchParams.get('subfolderId') || undefined;

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT data
      FROM vantor_app_state
      WHERE id = ${STATE_ID}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'State not initialized' }, { status: 500 });
    }

    const state = rows[0].data;
    const shares: ShareLink[] = state.shares || [];
    const files: VantorFile[] = state.files || [];
    const folders: VantorFolder[] = state.folders || [];

    const link = shares.find(s => s.id === shareId);
    if (!link) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    // Expiration & One-Time Self-Destruct check
    if (link.oneTimeOnly && link.selfDestructed) {
      return NextResponse.json({ error: 'This one-time access link has self-destructed after initial use.' }, { status: 410 });
    }

    if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 });
    }

    // Password validation
    const hasPassword = Boolean(link.password);
    const passwordMatches = link.password === passwordQuery;

    if (hasPassword && !passwordMatches) {
      const isIncorrectPassword = Boolean(passwordQuery);
      return NextResponse.json({
        passwordRequired: true,
        label: link.label,
        itemType: link.itemType,
        oneTimeOnly: link.oneTimeOnly,
        error: isIncorrectPassword ? 'Incorrect password. Please try again.' : undefined,
      }, { status: isIncorrectPassword ? 401 : 200 });
    }

    // Fetch targets
    if (link.itemType === 'file') {
      const file = files.find(f => f.id === link.itemId);
      if (!file) {
        return NextResponse.json({ error: 'Shared file not found in database' }, { status: 404 });
      }
      return NextResponse.json({
        passwordRequired: false,
        allowDownload: link.allowDownload,
        oneTimeOnly: link.oneTimeOnly,
        itemType: 'file',
        file,
      });
    } else {
      const rootFolder = folders.find(f => f.id === link.itemId);
      if (!rootFolder) {
        return NextResponse.json({ error: 'Shared folder not found in database' }, { status: 404 });
      }

      // Determine active target directory
      const activeFolderId = subfolderId || rootFolder.id;

      // Security check: ensure activeFolderId is equal to or a descendant of rootFolder.id
      if (activeFolderId !== rootFolder.id && !isDescendant(activeFolderId, rootFolder.id, folders)) {
        return NextResponse.json({ error: 'Access denied: Directory traversal blocked' }, { status: 403 });
      }

      const activeFolder = folders.find(f => f.id === activeFolderId) || rootFolder;
      const folderFiles = files.filter(f => f.folderId === activeFolderId);
      const folderFolders = folders.filter(f => f.parentId === activeFolderId);

      return NextResponse.json({
        passwordRequired: false,
        allowDownload: link.allowDownload,
        oneTimeOnly: link.oneTimeOnly,
        itemType: 'folder',
        folder: activeFolder,
        rootFolder: rootFolder,
        files: folderFiles,
        folders: folderFolders,
      });
    }

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ shareId: string }> }
) {
  const params = await props.params;
  const { shareId } = params;

  try {
    const { password, action } = await request.json().catch(() => ({}));
    const sql = getSql();

    const currentRows = await sql`
      SELECT data
      FROM vantor_app_state
      WHERE id = ${STATE_ID}
      LIMIT 1
    `;

    if (!currentRows || currentRows.length === 0) {
      return NextResponse.json({ error: 'State not initialized' }, { status: 500 });
    }

    const state = currentRows[0].data;
    const shares: ShareLink[] = state.shares || [];

    const linkIndex = shares.findIndex(s => s.id === shareId);
    if (linkIndex === -1) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    const link = shares[linkIndex];

    // Check self-destruct state
    if (link.oneTimeOnly && link.selfDestructed) {
      return NextResponse.json({ error: 'This one-time link has self-destructed.' }, { status: 410 });
    }

    // Expiration check
    if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 });
    }

    // Password validation
    if (link.password && link.password !== password) {
      return NextResponse.json({ error: 'Invalid password', passwordRequired: true }, { status: 401 });
    }

    // Increment metrics & set selfDestructed flag if oneTimeOnly
    const updatedShares = [...shares];
    const isSelfDestruct = Boolean(link.oneTimeOnly);

    if (action === 'download') {
      updatedShares[linkIndex] = {
        ...link,
        downloadsCount: (link.downloadsCount || 0) + 1,
        selfDestructed: isSelfDestruct ? true : link.selfDestructed,
      };
    } else {
      updatedShares[linkIndex] = {
        ...link,
        viewsCount: (link.viewsCount || 0) + 1,
        selfDestructed: isSelfDestruct ? true : link.selfDestructed,
      };
    }

    // Persist
    await sql`
      UPDATE vantor_app_state
      SET data = jsonb_set(data, '{shares}', ${JSON.stringify(updatedShares)}::jsonb),
          updated_at = NOW()
      WHERE id = ${STATE_ID}
    `;

    return NextResponse.json({ success: true, allowDownload: link.allowDownload });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
