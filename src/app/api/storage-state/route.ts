import { auth } from '@clerk/nextjs/server';
import { applyMutations, equal, Mutation, StateError } from '../../../lib/mutations';
import { actor, AppState, safeFile, validateHierarchy, validateMutations, visibleState } from '../../../lib/server/policy';
import { compareAndSwap, database, ensureSchema, errorResponse, hashPassword, jsonBody, newId, readState, registerUser } from '../../../lib/server/store';
import { TOTAL_STORAGE_CAPACITY_BYTES } from '../../../lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) throw new StateError('Unauthorized', 401);
    await ensureSchema();
    await registerUser(userId);
    const { state, revision } = await readState();
    return Response.json(visibleState(state, userId, revision), { headers });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) throw new StateError('Unauthorized', 401);
    const body = await jsonBody(request);
    if (!body || !Array.isArray(body.mutations) || body.mutations.length > 2000 || Object.keys(body).some(k => !['mutations', 'metadata'].includes(k))) throw new StateError('Use record mutations to save changes.');
    const mutations = body.mutations as Mutation[];
    if (mutations.some(m => !m || typeof m !== 'object' || m.before === undefined || m.after === undefined)) throw new StateError('Invalid mutation.');
    const metadata = body.metadata || {};
    await ensureSchema();
    for (let attempt = 0; attempt < 10; attempt++) {
      const { state, revision } = await readState();
      const user = actor(state, userId);
      validateMutations(state, userId, mutations, metadata);
      for (const [key, change] of Object.entries(metadata) as [string, any][]) {
        const visible = visibleState(state, userId, revision) as any;
        if (!change || !equal(visible[key], change.before)) throw new StateError('Platform settings changed. Reload and try again.', 409);
      }
      const translated: Mutation[] = [];
      const attachedUploadIds: string[] = [];
      const now = new Date().toISOString();
      for (const m of mutations) {
        if (m.collection === 'auditLogs') continue;
        const old = (state[m.collection] as any[]).find(r => r.id === m.id) || null;
        let next = m.after ? { ...m.after } : null;
        if (next && m.collection === 'files') {
          if (!old || next.uploadId) {
            const uploadId = old ? next.uploadId : m.id;
            if (typeof uploadId !== 'string') throw new StateError('Invalid upload reference.');
            const uploads = await database()`SELECT * FROM vantor_uploads WHERE file_id = ${uploadId} AND owner_id = ${userId}`;
            const upload = uploads[0];
            if (!upload || !upload.completed || upload.repository_id !== (next.repositoryId || 'repo-default') || (upload.folder_id || null) !== (next.folderId || null)) throw new StateError('Upload this file to the selected destination before saving it.', 403);
            if (upload.attached) throw new StateError('This upload is already attached to a file version.', 409);
            const alreadyAttached = [...state.files, ...(state.trash || []).filter(t => t.collection === 'files').map(t => t.record), ...(state.versions || []).map(v => v.record)].some(f => f.id === uploadId || f.storageId === uploadId);
            if (alreadyAttached) throw new StateError('This upload is already attached to a file version.', 409);
            attachedUploadIds.push(uploadId);
            next = { ...next, uploadId: undefined, storageId: uploadId, size: Number(upload.size), mimeType: upload.mime_type, r2Key: upload.r2_key || undefined, url: safeFile(next as any).url, content: undefined, uploadedBy: old?.uploadedBy || user.name, uploadedByRole: old?.uploadedByRole || user.role, downloadCount: old?.downloadCount || 0, createdAt: old?.createdAt || now, updatedAt: now };
          } else next = { ...next, content: old.content, url: old.url, r2Key: old.r2Key, storageId: old.storageId, uploadedBy: old.uploadedBy, uploadedByRole: old.uploadedByRole, createdAt: old.createdAt, downloadCount: old.downloadCount, updatedAt: now };
        }
        if (next && m.collection === 'comments') next = { ...next, authorId: old?.authorId || userId, authorName: old?.authorName || user.name, authorEmail: old?.authorEmail || user.email, authorRole: old?.authorRole || user.role, createdAt: old?.createdAt || now, updatedAt: now };
        if (next && m.collection === 'repositories') next.updatedAt = now;
        if (next && m.collection === 'shares') {
          if (!old && !/^share-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(m.id)) throw new StateError('Generate a new secure share token.');
          const { password, passwordHash: ignored, hasPassword, ...rest } = next;
          next = { ...rest, passwordHash: typeof password === 'string' && password ? hashPassword(password) : old?.passwordHash, viewsCount: old?.viewsCount || 0, downloadsCount: old?.downloadsCount || 0, accessCount: old?.accessCount || 0, selfDestructed: old?.selfDestructed || false, createdBy: old?.createdBy || userId, createdAt: old?.createdAt || now };
        }
        translated.push({ ...m, before: old, after: next });
      }
      const next = applyMutations(state, translated) as AppState;
      for (const [key, change] of Object.entries(metadata) as [string, any][]) next[key] = change.after;
      const removedRepos = new Set(state.repositories.filter(r => !next.repositories.some(n => n.id === r.id)).map(r => r.id));
      const removedFolders = new Set(state.folders.filter(f => !next.folders.some(n => n.id === f.id)).map(f => f.id));
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const folder of next.folders) if (removedRepos.has(folder.repositoryId || 'repo-default') || (folder.parentId && removedFolders.has(folder.parentId))) {
          if (!removedFolders.has(folder.id)) { removedFolders.add(folder.id); expanded = true; }
        }
      }
      next.folders = next.folders.filter(f => !removedFolders.has(f.id) && !removedRepos.has(f.repositoryId || 'repo-default'));
      next.files = next.files.filter(f => !removedRepos.has(f.repositoryId || 'repo-default') && !(f.folderId && removedFolders.has(f.folderId)));
      next.shares = next.shares.filter(s => (s.itemType === 'file' ? next.files : next.folders).some(i => i.id === s.itemId));
      validateHierarchy(next);
      const batchId = newId('deletion');
      const deleted = ['repositories', 'folders', 'files'].flatMap(collection => state[collection].filter((r: any) => !next[collection].some((n: any) => n.id === r.id)).map((record: any) => ({ id: newId('trash'), batchId, collection, record, deletedAt: now, deletedBy: userId })));
      next.trash = [...(state.trash || []), ...deleted];
      const totalBytes = next.files.reduce((sum, f) => sum + f.size, 0) + next.trash.filter(t => t.collection === 'files').reduce((sum, t) => sum + t.record.size, 0);
      if (totalBytes > TOTAL_STORAGE_CAPACITY_BYTES) throw new StateError('Storage capacity exceeded, including recoverable files.', 413);
      const versions = translated.filter(m => m.collection === 'files' && m.before && m.after).map(m => {
        const contentChanged = mutations.find(input => input.collection === 'files' && input.id === m.id)?.after?.uploadId;
        return { id: newId('version'), fileId: m.id, kind: contentChanged ? 'content' : 'metadata', record: { ...m.before, content: contentChanged ? m.before!.content : undefined }, createdAt: now, createdBy: userId };
      });
      const allVersions = [...(state.versions || []), ...versions];
      const counts = new Map<string, number>();
      next.versions = allVersions.reverse().filter(v => { const count = (counts.get(v.fileId) || 0) + 1; counts.set(v.fileId, count); return count <= 20; }).reverse();
      const logs = translated.map(m => ({ id: newId('log'), action: !m.after ? 'DELETE' : !m.before ? m.collection === 'files' ? 'UPLOAD' : m.collection === 'folders' ? 'FOLDER_CREATE' : 'METADATA_UPDATE' : 'METADATA_UPDATE', targetName: (m.after || m.before)?.name || m.id, targetType: m.collection === 'folders' ? 'folder' : 'file', performedBy: user.name, role: user.role, timestamp: now, details: `${m.after ? m.before ? 'Updated' : 'Created' : 'Deleted'} ${m.collection} record`, repositoryId: (m.after || m.before)?.repositoryId }));
      next.auditLogs = [...logs, ...(mutations.some(m => m.collection === 'auditLogs' && !m.after) && user.role === 'admin' ? [] : state.auditLogs)];
      const committed = await compareAndSwap(revision, next, attachedUploadIds);
      if (committed !== null) return Response.json(visibleState(next, userId, committed), { headers });
    }
    throw new StateError('Storage is busy. Try again.', 409);
  } catch (error) { return errorResponse(error); }
}
