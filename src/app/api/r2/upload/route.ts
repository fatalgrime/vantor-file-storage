import { auth } from '@clerk/nextjs/server';
import { deleteFromR2, isR2Configured, uploadToR2 } from '../../../../lib/r2';
import { actor, writableDestination } from '../../../../lib/server/policy';
import { database, ensureSchema, errorResponse, newId, readState } from '../../../../lib/server/store';
import { StateError } from '../../../../lib/mutations';
import { MAX_SINGLE_FILE_BYTES, TOTAL_STORAGE_CAPACITY_BYTES } from '../../../../lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) throw new StateError('Unauthorized', 401);
    await ensureSchema();
    const { state } = await readState();
    const user = actor(state, userId);
    const params = new URL(request.url).searchParams;
    const repositoryId = params.get('repositoryId') || 'repo-default', folderId = params.get('folderId') || null;
    if (!writableDestination(state, user, repositoryId, folderId)) throw new StateError('You cannot upload to this location.', 403);
    // Raw binary requests allow limits and cancellation without buffering a multipart envelope.
    const size = Number(request.headers.get('content-length') || 0);
    if (size > MAX_SINGLE_FILE_BYTES) throw new StateError('Maximum file size is 50 MB.', 413);
    const reader = request.body?.getReader();
    if (!reader) throw new StateError('No file provided.');
    const chunks: Uint8Array[] = []; let received = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_SINGLE_FILE_BYTES) { await reader.cancel(); throw new StateError('Maximum file size is 50 MB.', 413); }
      chunks.push(value);
    }
    if (state.files.reduce((sum, f) => sum + f.size, 0) + received > TOTAL_STORAGE_CAPACITY_BYTES) throw new StateError('Storage capacity exceeded.', 413);
    const fileId = newId('file');
    let filename: string;
    try { filename = decodeURIComponent(request.headers.get('x-file-name') || 'file'); } catch { throw new StateError('Invalid file name.'); }
    if (!filename.trim() || filename.length > 255) throw new StateError('Invalid file name.');
    const mimeType = request.headers.get('content-type') || 'application/octet-stream';
    if (mimeType.length > 255) throw new StateError('Invalid MIME type.');
    const buffer = Buffer.concat(chunks);
    let r2Key: string | null = null;
    // Atomically reserve quota, including uploads that are not attached yet.
    const reserved = await database()`WITH reserved AS (UPDATE vantor_storage_quota SET reserved_bytes = reserved_bytes + ${received} WHERE id = 'default' AND reserved_bytes + ${received} <= ${TOTAL_STORAGE_CAPACITY_BYTES} RETURNING id) INSERT INTO vantor_uploads (file_id, owner_id, repository_id, folder_id, size, mime_type) SELECT ${fileId}, ${userId}, ${repositoryId}, ${folderId}, ${received}, ${mimeType} FROM reserved RETURNING file_id`;
    if (!reserved.length) throw new StateError('Storage capacity exceeded.', 413);
    try {
      if (isR2Configured()) {
        r2Key = `files/${fileId}/${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        await uploadToR2(fileId, filename, buffer, mimeType);
      }
      else await database()`INSERT INTO vantor_file_blobs (file_id, filename, mime_type, data) VALUES (${fileId}, ${filename}, ${mimeType}, ${`\\x${buffer.toString('hex')}`}::bytea)`;
      await database()`UPDATE vantor_uploads SET r2_key = ${r2Key}, completed = true WHERE file_id = ${fileId}`;
    } catch (error) {
      // Release a reservation only after its bytes have been removed.
      const removed = !r2Key || await deleteFromR2(r2Key);
      if (removed) {
        await database()`DELETE FROM vantor_file_blobs WHERE file_id = ${fileId}`;
        await database()`WITH removed AS (DELETE FROM vantor_uploads WHERE file_id = ${fileId} RETURNING size) UPDATE vantor_storage_quota SET reserved_bytes = reserved_bytes - COALESCE((SELECT SUM(size) FROM removed), 0) WHERE id = 'default'`;
      }
      throw error;
    }
    return Response.json({ fileId, url: `/api/public/files/${fileId}`, size: received }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
