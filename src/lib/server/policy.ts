import { canReadItem, canEditItem, canEditRepository, hasRepositoryAccess } from '../authorization';
import { UserRole, VantorFile, VantorFolder, VantorRepository, VantorUser } from '../types';
import { StateError, Mutation, equal, applyMutations } from '../mutations';

export interface AppState {
  files: VantorFile[]; folders: VantorFolder[]; repositories: VantorRepository[]; users: VantorUser[];
  shares: any[]; comments: any[]; auditLogs: any[]; announcements: any[];
  changelog: any; changelogs: Record<string, any>; settings: any;
  trash?: any[]; versions?: any[]; [key: string]: any;
}
export function actor(state: AppState, userId: string) {
  const user = state.users.find(u => u.id === userId);
  if (!user || user.locked) throw new StateError('Your account does not have access.', 403);
  return user;
}
export const repoFor = (state: AppState, item: { repositoryId?: string }) => state.repositories.find(r => r.id === (item.repositoryId || 'repo-default'));
export function readable(state: AppState, user: VantorUser, item: VantorFile | VantorFolder) {
  const repo = repoFor(state, item);
  return Boolean(repo && canReadItem(user.role, user.id, item, state.folders, repo));
}
export function editable(state: AppState, user: VantorUser, item: VantorFile | VantorFolder) {
  const repo = repoFor(state, item);
  return Boolean(repo && canEditItem(user.role, user.id, item, state.folders, repo));
}
export function writableDestination(state: AppState, user: VantorUser, repositoryId: string, folderId: string | null) {
  const repo = state.repositories.find(r => r.id === repositoryId);
  if (!repo) return false;
  if (!folderId) return canEditRepository(user.role, user.id, repo);
  const folder = state.folders.find(f => f.id === folderId);
  return Boolean(folder && (folder.repositoryId || 'repo-default') === repositoryId && editable(state, user, folder));
}
export function safeFile(file: VantorFile, shareId?: string): VantorFile {
  const { content, url, r2Key, storageId, uploadId, ...metadata } = file as VantorFile & { r2Key?: string; storageId?: string; uploadId?: string };
  return { ...metadata, url: `/api/public/files/${encodeURIComponent(file.id)}${shareId ? `?shareId=${encodeURIComponent(shareId)}` : ''}` };
}
export function safeShare(link: any) {
  const { password, passwordHash, ...metadata } = link;
  return { ...metadata, hasPassword: Boolean(passwordHash || password) };
}
export function visibleState(state: AppState, userId: string, revision: number) {
  const user = actor(state, userId);
  const files = state.files.filter(f => readable(state, user, f));
  const folders = state.folders.filter(f => readable(state, user, f));
  const ids = new Set(files.map(f => f.id));
  const admin = user.role === 'admin';
  const repositories = state.repositories.filter(r => hasRepositoryAccess(user.role, user.id, r, state.files, state.folders));
  const repoIds = new Set(repositories.map(r => r.id));
  return {
    revision, files: files.map(f => safeFile(f)), folders, repositories,
    users: admin ? state.users : [user],
    shares: state.shares.filter(s => admin || (s.createdBy === userId && (s.itemType === 'file' ? files : folders).some(i => i.id === s.itemId))).map(safeShare),
    comments: state.comments.filter(c => ids.has(c.fileId)),
    auditLogs: admin ? state.auditLogs : [],
    announcements: admin ? state.announcements : state.announcements.filter(a => a.isActive),
    settings: state.settings, changelog: state.changelog,
    changelogs: Object.fromEntries(Object.entries(state.changelogs || {}).filter(([id]) => repoIds.has(id))),
    trash: admin ? (state.trash || []).map(t => ({ ...t, record: t.collection === 'files' ? safeFile(t.record) : t.record })) : [],
    versions: admin ? (state.versions || []).map(t => ({ ...t, record: safeFile(t.record) })) : [],
  };
}
const policyFields = ['permissionLevel', 'allowedRoles', 'allowedUserIds', 'collaborators'];
const roles = ['admin', 'manager', 'member', 'viewer'];
function strings(value: unknown, max = 200) { return Array.isArray(value) && value.length <= 1000 && value.every(v => typeof v === 'string' && v.length <= max); }
function validateRecord(collection: string, record: any) {
  if (!record || Array.isArray(record) || typeof record.id !== 'string') throw new StateError('Invalid record.');
  const textFields = ['name', 'description', 'originalName', 'fileType', 'category', 'extension', 'mimeType', 'formattedSize', 'createdAt', 'updatedAt', 'createdBy', 'uploadedBy', 'email', 'avatarUrl', 'lastActive', 'title', 'content', 'label', 'authorName', 'authorId', 'authorEmail', 'authorAvatarUrl'];
  for (const field of textFields) if (record[field] !== undefined && (typeof record[field] !== 'string' || record[field].length > (['content', 'description'].includes(field) ? 20000 : 2048))) throw new StateError(`Invalid ${field}.`);
  for (const field of ['repositoryId', 'folderId', 'parentId', 'itemId', 'fileId']) if (record[field] !== undefined && record[field] !== null && (typeof record[field] !== 'string' || record[field].length > 200)) throw new StateError(`Invalid ${field}.`);
  for (const field of ['allowedRoles', 'assignedRoles']) if (record[field] !== undefined && (!strings(record[field]) || record[field].some((r: string) => !roles.includes(r)))) throw new StateError('Invalid role list.');
  for (const field of ['allowedUserIds', 'assignedUserIds', 'tags', 'mentions']) if (record[field] !== undefined && !strings(record[field])) throw new StateError(`Invalid ${field}.`);
  if (record.collaborators !== undefined && (!Array.isArray(record.collaborators) || record.collaborators.length > 1000 || record.collaborators.some((c: any) => !c || typeof c.userId !== 'string' || !['viewer', 'editor'].includes(c.role) || (c.name !== undefined && typeof c.name !== 'string') || (c.email !== undefined && typeof c.email !== 'string')))) throw new StateError('Invalid collaborators.');
  for (const field of ['size', 'totalSize', 'itemCount', 'downloadCount', 'viewsCount', 'downloadsCount', 'accessCount']) if (record[field] !== undefined && (!Number.isSafeInteger(record[field]) || record[field] < 0)) throw new StateError(`Invalid ${field}.`);
  if (['files', 'folders', 'repositories'].includes(collection) && (typeof record.name !== 'string' || !record.name.trim() || record.name.length > 255)) throw new StateError('Invalid name.');
  if (collection === 'files' && (typeof record.mimeType !== 'string' || !record.mimeType || record.mimeType.length > 255 || /[\r\n]/.test(record.mimeType))) throw new StateError('Invalid MIME type.');
  if (collection === 'announcements') {
    if (typeof record.isActive !== 'boolean' || !['info', 'warning', 'alert', 'success'].includes(record.type)) throw new StateError('Invalid announcement.');
    if (record.linkUrl && !/^https?:\/\//i.test(record.linkUrl)) throw new StateError('Announcement links must use HTTP or HTTPS.');
  }
}
export function validateMutations(state: AppState, userId: string, mutations: Mutation[], metadata: any = {}) {
  const user = actor(state, userId), admin = user.role === 'admin';
  const view = visibleState(state, userId, 0);
  // Counters are maintained by file/session requests, not user edits. They must
  // not prevent an owner from revoking a frequently used share.
  applyMutations(view, mutations.map(m => {
    const current = (view as any)[m.collection]?.find((r: any) => r.id === m.id);
    const fields = m.collection === 'shares' ? ['viewsCount', 'downloadsCount', 'accessCount', 'selfDestructed'] : m.collection === 'files' ? ['downloadCount'] : m.collection === 'repositories' ? ['updatedAt'] : [];
    if (!m.before || !current || !fields.length) return m;
    const before = { ...m.before };
    for (const field of fields) { if (field in current) before[field] = current[field]; else delete before[field]; }
    return { ...m, before };
  }));
  for (const m of mutations) if (m.after) validateRecord(m.collection, m.after);
  const destinationState = applyMutations(state, mutations.filter(m => m.collection === 'folders' || m.collection === 'repositories').map(m => ({ ...m, before: state[m.collection].find((r: any) => r.id === m.id) || null }))) as AppState;
  if (Object.keys(metadata).some(k => !['settings', 'changelog', 'changelogs'].includes(k))) throw new StateError('Unknown metadata field.');
  if (Object.keys(metadata).length && !admin) throw new StateError('Only administrators can update platform settings.', 403);
  if (metadata.settings && (!metadata.settings.after || !['dark', 'light'].includes(metadata.settings.after.theme))) throw new StateError('Invalid theme settings.');
  for (const key of ['changelog', 'changelogs']) if (metadata[key]) {
    const entries = key === 'changelog' ? [metadata[key].after] : Object.values(metadata[key].after || {});
    if (entries.some((e: any) => !e || typeof e.title !== 'string' || typeof e.subtitle !== 'string' || !Array.isArray(e.releases) || e.releases.some((r: any) => !r || typeof r.date !== 'string' || typeof r.version !== 'string' || !strings(r.items, 10000)))) throw new StateError('Invalid changelog.');
  }
  for (const m of mutations) {
    const old = (state[m.collection] as any[]).find(r => r.id === m.id);
    const next = m.after;
    if (m.collection === 'auditLogs') {
      // Audit entries are created from authenticated mutations on the server.
      if (!admin && (!next || old)) throw new StateError('Audit logs cannot be modified.', 403);
      continue;
    }
    if (['users', 'announcements', 'repositories'].includes(m.collection)) {
      if (!admin) {
        // Repository timestamps are derived by content operations, not a permission grant.
        if (m.collection === 'repositories' && old && next && equal({ ...old, updatedAt: next.updatedAt }, next)) continue;
        throw new StateError('Only administrators can manage users, repositories, and announcements.', 403);
      }
      if (m.collection === 'users' && old?.id === userId && (!next || next.role !== 'admin' || next.locked)) throw new StateError('You cannot remove your own administrator access.');
      if (next && m.collection === 'users' && (!['admin', 'manager', 'member', 'viewer'].includes(next.role) || typeof next.locked !== 'boolean')) throw new StateError('Invalid user role.');
      if (next && m.collection === 'repositories' && (!strings(next.assignedUserIds) || !strings(next.assignedRoles))) throw new StateError('Invalid repository assignments.');
      continue;
    }
    if (m.collection === 'comments') {
      const file = state.files.find(f => f.id === (old?.fileId || next?.fileId));
      if (!file || !readable(state, user, file) || (!admin && old && old.authorId !== userId) || (next && (next.authorId !== (old?.authorId || userId) || next.fileId !== (old?.fileId || next.fileId)))) throw new StateError('You cannot change this comment.', 403);
      if (next && (typeof next.content !== 'string' || next.content.length > 20000)) throw new StateError('Invalid comment.');
      continue;
    }
    if (m.collection === 'shares') {
      const target = old || next;
      const item = (target?.itemType === 'file' ? state.files : state.folders).find(i => i.id === target?.itemId);
      if (!item || !editable(state, user, item) || (!admin && old && old.createdBy !== userId)) throw new StateError('You cannot manage this share.', 403);
      if (next && old && (old.itemId !== next.itemId || old.itemType !== next.itemType)) throw new StateError('Share target cannot change.');
      if (next && (!['file', 'folder'].includes(next.itemType) || typeof next.allowDownload !== 'boolean' || (next.maxAccessCount !== undefined && (!Number.isSafeInteger(next.maxAccessCount) || next.maxAccessCount < 1)) || (next.expiresAt && !Number.isFinite(Date.parse(next.expiresAt))))) throw new StateError('Invalid share settings.');
      continue;
    }
    if (m.collection === 'files' || m.collection === 'folders') {
      if (old && !editable(state, user, old)) throw new StateError('You cannot edit this item.', 403);
      if (!next && !['admin', 'manager'].includes(user.role)) throw new StateError('You cannot delete this item.', 403);
      if (!next) continue;
      if (typeof next.name !== 'string' || !next.name.trim() || next.name.length > 255 || !['public', 'authenticated', 'private', 'role_restricted'].includes(next.permissionLevel) || !Array.isArray(next.allowedRoles) || next.allowedRoles.some((r: UserRole) => !['admin', 'manager', 'member', 'viewer'].includes(r))) throw new StateError('Invalid item metadata.');
      if (old && !admin && policyFields.some(k => !equal((old as any)[k] ?? [], next[k] ?? []))) throw new StateError('Only administrators can change access policies.', 403);
      const destination = m.collection === 'files' ? next.folderId : next.parentId;
      if ((!old || (old.repositoryId || 'repo-default') !== (next.repositoryId || 'repo-default') || (m.collection === 'files' ? (old as VantorFile).folderId : (old as VantorFolder).parentId) !== destination) && !writableDestination(destinationState, user, next.repositoryId || 'repo-default', destination || null)) throw new StateError('You cannot write to that destination.', 403);
      if (m.collection === 'files' && old && ['content', 'r2Key', 'url', 'storageId', ...(next.uploadId ? [] : ['size', 'mimeType'])].some(k => !equal((m.before as any)?.[k], next[k]))) throw new StateError('Upload new content before changing the file.');
      if (m.collection === 'files' && next && (!Number.isFinite(next.size) || next.size < 0 || next.size > 50 * 1024 * 1024)) throw new StateError('Invalid file size.');
    }
  }
}
export function validateHierarchy(state: AppState) {
  const repoIds = new Set(state.repositories.map(r => r.id));
  const folders = new Map(state.folders.map(f => [f.id, f]));
  for (const item of [...state.files, ...state.folders]) {
    const repo = item.repositoryId || 'repo-default';
    if (!repoIds.has(repo)) throw new StateError('Repository does not exist.');
    let id = 'folderId' in item ? item.folderId : item.parentId;
    const seen = new Set<string>('parentId' in item ? [item.id] : []);
    while (id) {
      if (seen.has(id)) throw new StateError('Folders cannot contain a cycle.');
      seen.add(id);
      const folder = folders.get(id);
      if (!folder || (folder.repositoryId || 'repo-default') !== repo) throw new StateError('Folder must belong to the same repository.');
      id = folder.parentId;
    }
  }
}
