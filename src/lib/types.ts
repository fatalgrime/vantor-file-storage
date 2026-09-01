export type PermissionLevel = 'public' | 'authenticated' | 'role_restricted' | 'private';

export type UserRole = 'admin' | 'manager' | 'member' | 'viewer';

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
  allowedUserIds?: string[];
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

export type AnnouncementType = 'info' | 'warning' | 'alert' | 'success';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  linkUrl?: string;
  linkText?: string;
}

export interface AuditLog {
  id: string;
  action: 'UPLOAD' | 'DELETE' | 'RENAME' | 'METADATA_UPDATE' | 'PERMISSION_CHANGE' | 'DOWNLOAD' | 'FOLDER_CREATE' | 'ANNOUNCEMENT_CREATE' | 'ANNOUNCEMENT_UPDATE' | 'ANNOUNCEMENT_DELETE';
  targetName: string;
  targetType: 'file' | 'folder' | 'announcement';
  performedBy: string;
  role: UserRole;
  timestamp: string;
  details: string;
  repositoryId?: string;
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

export interface ShareLink {
  id: string;            // Unique hash/token for the URL
  itemId: string;        // ID of target VantorFile or VantorFolder
  itemType: 'file' | 'folder';
  name: string;          // Name of the shared item
  label: string;         // Custom link label (e.g. "Public Access")
  permission: 'view' | 'edit'; // 'view' is view-only, 'edit' allows downloads
  allowDownload: boolean; // Fine-grained permission: can they download?
  password?: string;     // Password protection (optional)
  expiresAt?: string;    // Expiration timestamp (optional)
  maxAccessCount?: number; // Maximum visits (optional)
  oneTimeOnly?: boolean; // Self-destruct after single view or download
  selfDestructed?: boolean; // Marked true once accessed
  createdAt: string;
  createdBy: string;
  viewsCount: number;
  downloadsCount: number;
}

export interface FileComment {
  id: string;
  fileId: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  authorRole?: UserRole;
  authorAvatarUrl?: string;
  content: string; // Markdown text with @mentions
  createdAt: string; // ISO string
  updatedAt?: string;
  parentId?: string | null; // For threaded replies
  resolved?: boolean;
  mentions?: string[]; // Array of user names/IDs mentioned
}


