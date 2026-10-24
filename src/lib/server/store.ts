import { neon } from '@neondatabase/serverless';
import { currentUser } from '@clerk/nextjs/server';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { INITIAL_REPOSITORIES, INITIAL_HERO_CHANGELOG } from '../db';
import { StateError } from '../mutations';
import { AppState } from './policy';

export const initialState: AppState = {
  files: [], folders: [], repositories: INITIAL_REPOSITORIES, users: [], shares: [], comments: [],
  auditLogs: [], announcements: [], changelog: INITIAL_HERO_CHANGELOG, changelogs: {}, settings: { theme: 'dark' }, trash: [], versions: [],
};
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured.');
  return neon(process.env.DATABASE_URL);
}
let schema: Promise<void> | undefined;
export function ensureSchema() {
  if (!schema) schema = (async () => {
    const sql = database();
    await sql`CREATE TABLE IF NOT EXISTS vantor_app_state (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revision BIGINT NOT NULL DEFAULT 0)`;
    await sql`ALTER TABLE vantor_app_state ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0`;
    await sql`INSERT INTO vantor_app_state (id, data) VALUES ('default', ${JSON.stringify(initialState)}::jsonb) ON CONFLICT (id) DO NOTHING`;
    await sql`CREATE TABLE IF NOT EXISTS vantor_file_blobs (file_id TEXT PRIMARY KEY, filename TEXT NOT NULL, mime_type TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS vantor_uploads (file_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, repository_id TEXT NOT NULL, folder_id TEXT, size BIGINT NOT NULL, mime_type TEXT NOT NULL, r2_key TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`ALTER TABLE vantor_uploads ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false`;
    await sql`ALTER TABLE vantor_uploads ADD COLUMN IF NOT EXISTS attached BOOLEAN NOT NULL DEFAULT false`;
    await sql`CREATE TABLE IF NOT EXISTS vantor_storage_quota (id TEXT PRIMARY KEY, reserved_bytes BIGINT NOT NULL)`;
    await sql`INSERT INTO vantor_storage_quota (id, reserved_bytes) SELECT 'default', COALESCE((SELECT SUM((f->>'size')::bigint) FROM vantor_app_state s, jsonb_array_elements(s.data->'files') f WHERE s.id = 'default'), 0) + COALESCE((SELECT SUM((t->'record'->>'size')::bigint) FROM vantor_app_state s, jsonb_array_elements(COALESCE(s.data->'trash', '[]'::jsonb)) t WHERE s.id = 'default' AND t->>'collection' = 'files'), 0) + COALESCE((SELECT SUM(u.size) FROM vantor_uploads u WHERE NOT EXISTS (SELECT 1 FROM vantor_app_state s, jsonb_array_elements(s.data->'files') f WHERE s.id = 'default' AND f->>'id' = u.file_id) AND NOT EXISTS (SELECT 1 FROM vantor_app_state s, jsonb_array_elements(COALESCE(s.data->'trash', '[]'::jsonb)) t WHERE s.id = 'default' AND t->>'collection' = 'files' AND t->'record'->>'id' = u.file_id)), 0) ON CONFLICT (id) DO NOTHING`;
    await sql`CREATE TABLE IF NOT EXISTS vantor_share_sessions (token_hash TEXT PRIMARY KEY, share_id TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, grant_hash TEXT)`;
    await sql`ALTER TABLE vantor_share_sessions ADD COLUMN IF NOT EXISTS grant_hash TEXT`;
    await sql`CREATE TABLE IF NOT EXISTS vantor_share_attempts (share_id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    // Retire plaintext legacy passwords before any response is returned.
    for (let attempt = 0; attempt < 10; attempt++) {
      const row = await readState();
      if (!row.state.shares.some(s => s.password)) break;
      const state = { ...row.state, shares: row.state.shares.map(s => {
        if (!s.password) return s;
        const { password, ...rest } = s;
        return { ...rest, passwordHash: hashPassword(password) };
      }) };
      if (await compareAndSwap(row.revision, state)) break;
      if (attempt === 9) throw new StateError('Storage is busy. Try again.', 409);
    }
  })().catch(error => { schema = undefined; throw error; });
  return schema;
}
export async function readState(): Promise<{ state: AppState; revision: number }> {
  const rows = await database()`SELECT data, revision FROM vantor_app_state WHERE id = 'default'`;
  if (!rows[0]) throw new Error('Storage is not initialized.');
  return { state: { ...initialState, ...rows[0].data }, revision: Number(rows[0].revision) };
}
export async function compareAndSwap(revision: number, state: AppState, uploadIds: string[] = []) {
  if (uploadIds.length) {
    const uniqueIds = [...new Set(uploadIds)];
    if (uniqueIds.length !== uploadIds.length) throw new StateError('An upload cannot be attached twice.');
    const rows = await database()`WITH uploads AS (SELECT file_id FROM vantor_uploads WHERE file_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(uniqueIds)}::jsonb)) AND completed = true AND attached = false ORDER BY file_id FOR UPDATE), committed AS (UPDATE vantor_app_state SET data = ${JSON.stringify(state)}::jsonb, revision = revision + 1, updated_at = NOW() WHERE id = 'default' AND revision = ${revision} AND (SELECT COUNT(*) FROM uploads) = ${uniqueIds.length} RETURNING revision), claimed AS (UPDATE vantor_uploads SET attached = true WHERE file_id IN (SELECT file_id FROM uploads) AND EXISTS (SELECT 1 FROM committed) RETURNING file_id) SELECT revision FROM committed`;
    return rows.length ? Number(rows[0].revision) : null;
  }
  const rows = await database()`UPDATE vantor_app_state SET data = ${JSON.stringify(state)}::jsonb, revision = revision + 1, updated_at = NOW() WHERE id = 'default' AND revision = ${revision} RETURNING revision`;
  return rows.length ? Number(rows[0].revision) : null;
}
export async function registerUser(userId: string) {
  if ((await readState()).state.users.some(u => u.id === userId)) return;
  const profile = await currentUser();
  if (!profile || profile.id !== userId) throw new StateError('Unauthorized', 401);
  for (let attempt = 0; attempt < 10; attempt++) {
    const { state, revision } = await readState();
    if (state.users.some(u => u.id === userId)) return;
    const admins = (process.env.VANTOR_ADMIN_USER_IDS || '').split(',').map(s => s.trim());
    const user = { id: userId, name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Vantor User', email: profile.emailAddresses.find(e => e.id === profile.primaryEmailAddressId)?.emailAddress || '', avatarUrl: profile.imageUrl, role: admins.includes(userId) ? 'admin' as const : 'viewer' as const, locked: false, lastActive: new Date().toISOString() };
    if (await compareAndSwap(revision, { ...state, users: [...state.users, user] })) return;
  }
  throw new StateError('Storage is busy. Try again.', 409);
}
export function hashPassword(password: string) {
  if (typeof password !== 'string' || password.length > 1024) throw new StateError('Password is too long.');
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: unknown, hash?: string) {
  if (!hash) return true;
  if (typeof password !== 'string' || password.length > 1024) return false;
  const [kind, salt, expected] = hash.split(':');
  if (kind !== 'scrypt' || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64), bytes = Buffer.from(expected, 'hex');
  return actual.length === bytes.length && timingSafeEqual(actual, bytes);
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const newId = (prefix: string) => `${prefix}-${randomUUID()}`;
export function errorResponse(error: unknown) {
  if (!(error instanceof StateError)) console.error('Storage request failed:', error);
  return Response.json({ error: error instanceof StateError ? error.message : 'The storage request failed. Please try again.' }, { status: error instanceof StateError ? error.status : 500, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function jsonBody(request: Request, limit = 2 * 1024 * 1024) {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new StateError('Request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new StateError('Missing request body.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new StateError('Request is too large.', 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new StateError('Invalid JSON.'); }
}
