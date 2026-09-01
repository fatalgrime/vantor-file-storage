import { VantorFile, VantorFolder, AuditLog, HeroChangelogData, VantorRepository, VantorUser, Announcement, FileComment } from './types';

const NEON_DATABASE_URL = process.env.DATABASE_URL;

export const isNeonConnected = (): boolean => {
  return Boolean(NEON_DATABASE_URL && !NEON_DATABASE_URL.includes('vantor_user:secure_password'));
};

export const TOTAL_STORAGE_CAPACITY_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB Capacity
export const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024; // 50 MB Single File Limit

export const INITIAL_HERO_CHANGELOG: HeroChangelogData = {
  title: '',
  subtitle: '',
  releases: []
};

export const DEFAULT_REPOSITORY_ID = 'repo-default';

export const INITIAL_REPOSITORIES: VantorRepository[] = [
  {
    id: DEFAULT_REPOSITORY_ID,
    name: 'Vantor Root Repository',
    description: 'Default root storage workspace',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'System Operator',
    assignedUserIds: [],
    assignedRoles: ['admin', 'manager', 'member', 'viewer'],
  },
];

export const INITIAL_USERS: VantorUser[] = [];

export const INITIAL_FOLDERS: VantorFolder[] = [];

export const INITIAL_FILES: VantorFile[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [];

export const INITIAL_COMMENTS: FileComment[] = [];


