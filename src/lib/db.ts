import { VantorFile, VantorFolder, AuditLog, HeroChangelogData, VantorRepository, VantorUser, Announcement } from './types';

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

export const INITIAL_REPOSITORIES: VantorRepository[] = [];

export const INITIAL_USERS: VantorUser[] = [];

export const INITIAL_FOLDERS: VantorFolder[] = [];

export const INITIAL_FILES: VantorFile[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'announcement-1',
    title: '🚀 Sitewide Storage Upgrade & Infrastructure Enhancement',
    content: 'Total storage capacity has been increased to 50 GB! Administrators can now publish sitewide announcements and manage high-capacity file assets.',
    type: 'info',
    isActive: true,
    createdAt: new Date().toISOString(),
    createdBy: 'System Operator',
    linkText: 'Learn More',
  },
];

