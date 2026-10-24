import { auth } from '@clerk/nextjs/server';
import { actor, validateHierarchy, visibleState } from '../../../../lib/server/policy';
import { StateError } from '../../../../lib/mutations';
import { compareAndSwap, ensureSchema, errorResponse, jsonBody, newId, readState } from '../../../../lib/server/store';
import { assignRepositorySlugs } from '../../../../lib/repositories';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) throw new StateError('Unauthorized', 401);
    const body = await jsonBody(request, 4096);
    if (!['trash', 'versions'].includes(body.kind) || typeof body.id !== 'string') throw new StateError('Invalid recovery request.');
    await ensureSchema();
    for (let attempt = 0; attempt < 10; attempt++) {
      const { state, revision } = await readState();
      const user = actor(state, userId);
      if (user.role !== 'admin') throw new StateError('Only administrators can restore records.', 403);
      const entry = state[body.kind]?.find((e: any) => e.id === body.id);
      if (!entry) throw new StateError('Recovery record not found.', 404);
      const next = { ...state };
      if (body.kind === 'trash') {
        const group = state.trash!.filter(e => e.batchId === entry.batchId);
        for (const e of group) {
          if (next[e.collection].some((r: any) => r.id === e.record.id)) throw new StateError('A record with this ID already exists.', 409);
          next[e.collection] = [...next[e.collection], e.record];
        }
        next.trash = state.trash!.filter(e => e.batchId !== entry.batchId);
      } else {
        const current = state.files.find(f => f.id === entry.fileId);
        if (!current) throw new StateError('Restore the deleted file first.', 409);
        const contentVersion = entry.kind === 'content';
        next.versions = [...state.versions!, { id: newId('version'), fileId: current.id, kind: contentVersion ? 'content' : 'metadata', record: { ...current, content: contentVersion ? current.content : undefined }, createdAt: new Date().toISOString(), createdBy: userId }];
        next.files = state.files.map(f => f.id === current.id ? { ...entry.record, ...(contentVersion ? {} : { content: f.content, url: f.url, r2Key: (f as any).r2Key, storageId: (f as any).storageId, size: f.size, formattedSize: f.formattedSize, mimeType: f.mimeType, extension: f.extension, fileType: f.fileType, originalName: f.originalName }), downloadCount: f.downloadCount, updatedAt: new Date().toISOString() } : f);
      }
      next.repositories = assignRepositorySlugs(next.repositories);
      validateHierarchy(next);
      const counts = new Map<string, number>();
      next.versions = [...(next.versions || [])].reverse().filter(v => { const count = (counts.get(v.fileId) || 0) + 1; counts.set(v.fileId, count); return count <= 20; }).reverse();
      next.auditLogs = [{ id: newId('log'), action: 'METADATA_UPDATE', targetName: entry.record.name, targetType: 'file', performedBy: user.name, role: user.role, timestamp: new Date().toISOString(), details: `Restored ${body.kind} record` }, ...state.auditLogs];
      const committed = await compareAndSwap(revision, next);
      if (committed !== null) return Response.json(visibleState(next, userId, committed), { headers: { 'Cache-Control': 'private, no-store' } });
    }
    throw new StateError('Storage is busy. Try again.', 409);
  } catch (error) { return errorResponse(error); }
}
