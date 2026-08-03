import { VantorFile, VantorFolder, AuditLog, HeroChangelogData, VantorRepository, VantorUser } from './types';

const NEON_DATABASE_URL = process.env.DATABASE_URL;

export const isNeonConnected = (): boolean => {
  return Boolean(NEON_DATABASE_URL && !NEON_DATABASE_URL.includes('vantor_user:secure_password'));
};

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
