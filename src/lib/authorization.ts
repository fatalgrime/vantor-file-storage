import { PermissionLevel, UserRole, VantorFile, VantorFolder, VantorRepository } from './types';

export const ALL_USER_ROLES: UserRole[] = ['admin', 'author', 'viewer'];

export const hasRepositoryAccess = (
  role: UserRole,
  userId: string,
  repository: VantorRepository,
  allFiles: VantorFile[] = [],
  allFolders: VantorFolder[] = []
): boolean => {
  if (role === 'admin') return true;

  if (role === 'author') {
    return repository.assignedRoles?.includes('author') || repository.assignedUserIds?.includes(userId);
  }

  if (repository.assignedUserIds?.includes(userId)) return true;

  const repoId = repository.id;
  const hasFolderInvite = allFolders.some(
    (f) => (f.repositoryId || 'repo-default') === repoId && f.collaborators?.some((c) => c.userId === userId)
  );
  if (hasFolderInvite) return true;

  const hasFileInvite = allFiles.some(
    (f) => (f.repositoryId || 'repo-default') === repoId && f.collaborators?.some((c) => c.userId === userId)
  );
  if (hasFileInvite) return true;

  return false;
};

export const canEditRepository = (
  role: UserRole,
  userId: string,
  repository: VantorRepository
): boolean => {
  if (role === 'admin') return true;
  if (role !== 'author') return false;
  return repository.assignedRoles?.includes('author') || repository.assignedUserIds?.includes(userId);
};

export const canDeleteContent = (role: UserRole): boolean => role === 'admin';

export const canManagePlatform = (role: UserRole): boolean => role === 'admin';

export const canReadItem = (
  role: UserRole,
  userId: string,
  item: VantorFile | VantorFolder,
  allFolders: VantorFolder[] = [],
  repository: VantorRepository | undefined = undefined
): boolean => {
  if (role === 'admin') return true;

  if (item.collaborators?.some((c) => c.userId === userId)) return true;

  let currentParentId = 'parentId' in item ? item.parentId : (item as VantorFile).folderId;
  while (currentParentId) {
    const parentFolder = allFolders.find((f) => f.id === currentParentId);
    if (!parentFolder) break;
    if (parentFolder.collaborators?.some((c) => c.userId === userId)) return true;
    currentParentId = parentFolder.parentId;
  }

  if (role === 'viewer') {
    if (repository && repository.assignedUserIds?.includes(userId)) {
      switch (item.permissionLevel) {
        case 'admin_only':
          return false;
        case 'role_restricted':
          return item.allowedRoles?.includes(role) ?? false;
        default:
          return true;
      }
    }
    return false;
  }

  switch (item.permissionLevel) {
    case 'admin_only':
      return false;
    case 'role_restricted':
      return item.allowedRoles?.includes(role) ?? false;
    default:
      return true;
  }
};

export const canEditItem = (
  role: UserRole,
  userId: string,
  item: VantorFile | VantorFolder,
  allFolders: VantorFolder[] = [],
  repository: VantorRepository | undefined = undefined
): boolean => {
  if (role === 'admin') return true;

  if (repository && canEditRepository(role, userId, repository)) return true;

  const directCollab = item.collaborators?.find((c) => c.userId === userId);
  if (directCollab?.role === 'editor') return true;

  let currentParentId = 'parentId' in item ? item.parentId : (item as VantorFile).folderId;
  while (currentParentId) {
    const parentFolder = allFolders.find((f) => f.id === currentParentId);
    if (!parentFolder) break;
    const parentCollab = parentFolder.collaborators?.find((c) => c.userId === userId);
    if (parentCollab?.role === 'editor') return true;
    currentParentId = parentFolder.parentId;
  }

  return false;
};
