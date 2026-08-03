export type PermissionLevel = 'public' | 'authenticated' | 'role_restricted' | 'admin_only';

export type UserRole = 'admin' | 'author' | 'viewer';

export interface Collaborator {
  userId: string;
  email: string;
  name: string;
  role: 'viewer' | 'editor';
}

export interface VantorUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  locked: boolean;
  lastActive: string;
}

export interface VantorFile {
  id: string;
  name: string;
  originalName: string;
  fileType: string; // e.g. "Markdown document", "Folder", "Unknown file type"
  category: string;
  extension: string;
  mimeType: string;
  size: number; // in bytes
  formattedSize: string;
  folderId: string | null;
  description: string;
  tags: string[];
  content?: string; // Text content, base64 data, or markdown
  url?: string;
  permissionLevel: PermissionLevel;
  allowedRoles: UserRole[];
  allowedUserIds: string[];
  uploadedBy: string;
  uploadedByRole: UserRole;
  downloadCount: number;
  createdAt: string; // e.g. "2026-07-25T14:20:00Z"
  updatedAt: string; // relative display e.g. "yesterday", "last week"
  repositoryId?: string;
  collaborators?: Collaborator[];
}

export interface VantorFolder {
  id: string;
  name: string;
  parentId: string | null;
  description: string;
  permissionLevel: PermissionLevel;
  allowedRoles: UserRole[];
  itemCount: number;
  totalSize: number;
  formattedSize: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  repositoryId?: string;
  collaborators?: Collaborator[];
}

export interface VantorRepository {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  assignedUserIds: string[];
  assignedRoles: UserRole[];
}

export interface AuditLog {
  id: string;
  action: 'UPLOAD' | 'DELETE' | 'RENAME' | 'METADATA_UPDATE' | 'PERMISSION_CHANGE' | 'DOWNLOAD' | 'FOLDER_CREATE';
  targetName: string;
  targetType: 'file' | 'folder';
  performedBy: string;
  role: UserRole;
  timestamp: string;
  details: string;
}

export interface HeroChangelogData {
  title: string;
  subtitle: string;
  releases: {
    date: string;
    version: string;
    items: string[];
  }[];
}
