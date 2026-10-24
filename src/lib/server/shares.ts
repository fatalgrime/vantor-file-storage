import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { AppState, safeFile } from './policy';
import { StateError } from '../mutations';
import { database, readState, tokenHash, verifyPassword } from './store';

export function isWithinFolder(folderId: string | null, rootId: string, state: AppState): boolean {
  const seen = new Set<string>();
  while (folderId && !seen.has(folderId)) {
    if (folderId === rootId) return true;
    seen.add(folderId);
    folderId = state.folders.find(f => f.id === folderId)?.parentId || null;
  }
  return false;
}
export function activeShare(state: AppState, shareId: string) {
  const link = state.shares.find(s => s.id === shareId);
  if (!link) throw new StateError('Share link not found.', 404);
  if (link.expiresAt && Date.parse(link.expiresAt) <= Date.now()) throw new StateError('Share link has expired.', 410);
  if (!(link.itemType === 'file' ? state.files : state.folders).some(i => i.id === link.itemId)) throw new StateError('The shared item was deleted.', 410);
  return link;
}
const cookieName = (id: string) => `vantor_share_${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
export const grantHash = (link: any) => tokenHash(JSON.stringify([link.itemId, link.itemType, link.passwordHash || '', link.createdAt || '']));
export async function hasShareSession(shareId: string, link?: any) {
  const token = (await cookies()).get(cookieName(shareId))?.value;
  if (!token) return false;
  if (!link) link = activeShare((await readState()).state, shareId);
  const rows = await database()`SELECT token_hash FROM vantor_share_sessions WHERE token_hash = ${tokenHash(token)} AND share_id = ${shareId} AND grant_hash = ${grantHash(link)} AND expires_at > NOW()`;
  return rows.length > 0;
}
export function checkShareCapacity(link: any) {
  if (link.oneTimeOnly && link.selfDestructed) throw new StateError('This one-time link has already been used.', 410);
  if (link.maxAccessCount && (link.accessCount || 0) >= link.maxAccessCount) throw new StateError('This link has reached its access limit.', 410);
}
export async function openShare(shareId: string, password: unknown) {
  const { state: initial } = await readState();
  const initialLink = activeShare(initial, shareId);
  const existing = await hasShareSession(shareId, initialLink);
  if (existing) return;
  checkShareCapacity(initialLink);
  if (initialLink.passwordHash) {
    const attempts = await database()`INSERT INTO vantor_share_attempts (share_id, attempts) VALUES (${shareId}, 1) ON CONFLICT (share_id) DO UPDATE SET attempts = CASE WHEN vantor_share_attempts.window_start < NOW() - INTERVAL '5 minutes' THEN 1 ELSE vantor_share_attempts.attempts + 1 END, window_start = CASE WHEN vantor_share_attempts.window_start < NOW() - INTERVAL '5 minutes' THEN NOW() ELSE vantor_share_attempts.window_start END RETURNING attempts`;
    if (Number(attempts[0].attempts) > 10) throw new StateError('Too many password attempts. Try again in five minutes.', 429);
    if (!verifyPassword(password, initialLink.passwordHash)) throw new StateError('Incorrect password.', 401);
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    const { state, revision } = await readState();
    const link = activeShare(state, shareId);
    if (link.passwordHash !== initialLink.passwordHash) throw new StateError('Share settings changed. Please try again.', 409);
    checkShareCapacity(link);
    const next = { ...state, shares: state.shares.map(s => s.id === shareId ? { ...s, accessCount: (s.accessCount || 0) + 1, viewsCount: (s.viewsCount || 0) + 1, selfDestructed: Boolean(s.oneTimeOnly) || s.selfDestructed } : s) };
    const token = randomBytes(32).toString('base64url');
    const expires = new Date(Math.min(Date.now() + 15 * 60 * 1000, link.expiresAt ? Date.parse(link.expiresAt) : Infinity));
    // Grant the session and consume the visit in one database statement.
    const admitted = await database()`WITH admitted AS (UPDATE vantor_app_state SET data = ${JSON.stringify(next)}::jsonb, revision = revision + 1, updated_at = NOW() WHERE id = 'default' AND revision = ${revision} RETURNING id) INSERT INTO vantor_share_sessions (token_hash, share_id, expires_at, grant_hash) SELECT ${tokenHash(token)}, ${shareId}, ${expires.toISOString()}, ${grantHash(link)} FROM admitted RETURNING token_hash`;
    if (!admitted.length) continue;
    (await cookies()).set(cookieName(shareId), token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: `/api/public`, expires });
    return;
  }
  throw new StateError('Share is busy. Try again.', 409);
}
export async function authorizeSharedFile(state: AppState, shareId: string, fileId: string, download: boolean) {
  const link = activeShare(state, shareId);
  if (!await hasShareSession(shareId, link)) throw new StateError('Open the share link to access this file.', 401);
  const file = state.files.find(f => f.id === fileId);
  if (!file || !(link.itemType === 'file' ? link.itemId === file.id : isWithinFolder(file.folderId, link.itemId, state))) throw new StateError('File is outside this share.', 403);
  if (download && !link.allowDownload) throw new StateError('Downloads are disabled for this share.', 403);
  return file;
}
export function sharePayload(state: AppState, shareId: string, subfolderId?: string) {
  const link = activeShare(state, shareId);
  const meta = { passwordRequired: false, label: link.label, allowDownload: link.allowDownload, oneTimeOnly: link.oneTimeOnly, itemType: link.itemType };
  if (link.itemType === 'file') return { ...meta, file: safeFile(state.files.find(f => f.id === link.itemId)!, shareId) };
  const id = subfolderId || link.itemId;
  if (!isWithinFolder(id, link.itemId, state)) throw new StateError('Folder is outside this share.', 403);
  const folder = state.folders.find(f => f.id === id);
  if (!folder) throw new StateError('Folder not found.', 404);
  return { ...meta, folder, rootFolder: state.folders.find(f => f.id === link.itemId), folders: state.folders.filter(f => f.parentId === id), files: state.files.filter(f => f.folderId === id).map(f => safeFile(f, shareId)) };
}
