import { auth } from '@clerk/nextjs/server';
import { actor, readable } from './policy';
import { authorizeSharedFile } from './shares';
import { compareAndSwap, database, ensureSchema, errorResponse, newId, readState } from './store';
import { StateError } from '../mutations';
import { readR2Object } from '../r2';

async function logDownload(fileId: string, shareId: string | null, userId: string | null) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { state, revision } = await readState();
    const file = shareId ? await authorizeSharedFile(state, shareId, fileId, true) : state.files.find(f => f.id === fileId);
    const user = userId ? actor(state, userId) : undefined;
    if (!file || (!shareId && (!user || !readable(state, user, file)))) throw new StateError('File not found.', 404);
    const next = { ...state, files: state.files.map(f => f.id === fileId ? { ...f, downloadCount: (f.downloadCount || 0) + 1 } : f), shares: state.shares.map(s => s.id === shareId ? { ...s, downloadsCount: (s.downloadsCount || 0) + 1 } : s), auditLogs: [{ id: newId('log'), action: 'DOWNLOAD', targetName: file.name, targetType: 'file', performedBy: user?.name || 'Shared link recipient', role: user?.role || 'viewer', timestamp: new Date().toISOString(), details: 'Download requested through an authorized file endpoint', repositoryId: file.repositoryId }, ...state.auditLogs] };
    if (await compareAndSwap(revision, next) !== null) return;
  }
  throw new StateError('Storage is busy. Try downloading again.', 409);
}

export async function serveFile(request: Request, fileId: string) {
  try {
    await ensureSchema();
    const { state } = await readState();
    const params = new URL(request.url).searchParams;
    const shareId = params.get('shareId'), download = params.get('download') === '1';
    let file;
    let actorId: string | null = null;
    if (shareId) file = await authorizeSharedFile(state, shareId, fileId, download);
    else {
      const { userId } = await auth();
      if (!userId) throw new StateError('Unauthorized', 401);
      const user = actor(state, userId);
      actorId = userId;
      file = state.files.find(f => f.id === fileId);
      if (!file || !readable(state, user, file)) throw new StateError('File not found.', 404);
    }
    if (download && !request.headers.has('range')) await logDownload(fileId, shareId, actorId);
    const headers = new Headers({
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      'Accept-Ranges': 'bytes', 'Referrer-Policy': 'no-referrer',
    });
    let key = (file as any).r2Key as string | undefined;
    // Legacy keys are extracted locally; never fetch arbitrary stored URLs.
    if (!key && file.url?.startsWith('https://')) {
      try { key = decodeURIComponent(new URL(file.url).pathname.match(/\/(files\/[^?#]+)/)?.[1] || '') || undefined; } catch { /* use the blob fallback */ }
    }
    const range = request.headers.get('range') || undefined;
    if (range && !/^bytes=\d*-\d*$/.test(range)) throw new StateError('Invalid range.', 416);
    if (key) {
      const object = await readR2Object(key, range);
      if (!object.Body) throw new StateError('File content not found.', 404);
      if (object.ContentLength !== undefined) headers.set('Content-Length', String(object.ContentLength));
      if (object.ContentRange) headers.set('Content-Range', object.ContentRange);
      return new Response(object.Body.transformToWebStream(), { status: object.ContentRange ? 206 : 200, headers });
    }
    let buffer: Buffer | undefined;
    if (file.content) {
      buffer = file.content.startsWith('data:') ? Buffer.from(file.content.slice(file.content.indexOf(',') + 1), 'base64') : Buffer.from(file.content);
    } else {
      const legacyId = file.url?.match(/^\/api\/public\/files\/([^/?]+)/)?.[1];
      const rows = await database()`SELECT data FROM vantor_file_blobs WHERE file_id = ${(file as any).storageId || legacyId || file.id} LIMIT 1`;
      const data = rows[0]?.data;
      if (data !== undefined) buffer = Buffer.isBuffer(data) ? data : typeof data === 'string' ? Buffer.from(data.replace(/^\\x/, ''), 'hex') : Buffer.from(data);
    }
    if (!buffer) throw new StateError('File content not found.', 404);
    let status = 200;
    if (range) {
      const [first, last] = range.slice(6).split('-');
      const start = first ? Number(first) : Math.max(0, buffer.length - Number(last));
      const end = first ? last ? Math.min(Number(last), buffer.length - 1) : buffer.length - 1 : buffer.length - 1;
      if (start > end || start >= buffer.length || (!first && !last)) throw new StateError('Range is outside the file.', 416);
      headers.set('Content-Range', `bytes ${start}-${end}/${buffer.length}`);
      buffer = buffer.subarray(start, end + 1); status = 206;
    }
    headers.set('Content-Length', String(buffer.length));
    return new Response(new Uint8Array(buffer), { status, headers });
  } catch (error) { return errorResponse(error); }
}
