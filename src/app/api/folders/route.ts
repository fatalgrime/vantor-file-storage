import { auth } from '@clerk/nextjs/server';
import { StateError } from '../../../lib/mutations';
import { actor, AppState, validateHierarchy, visibleState, writableDestination } from '../../../lib/server/policy';
import { compareAndSwap, ensureSchema, errorResponse, jsonBody, newId, readState } from '../../../lib/server/store';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) throw new StateError('Unauthorized', 401);
    const body = await jsonBody(request, 4096);
    if (!body || Object.keys(body).some(key => !['name', 'description', 'permissionLevel', 'allowedRoles', 'parentId', 'repositoryId'].includes(key))) throw new StateError('Invalid folder request.');
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 255) throw new StateError('Invalid folder name.');
    if (!['public', 'authenticated', 'private', 'role_restricted'].includes(body.permissionLevel) || !Array.isArray(body.allowedRoles) || body.allowedRoles.some((role: string) => !['admin', 'manager', 'member', 'viewer'].includes(role))) throw new StateError('Invalid folder permissions.');
    if (body.parentId !== undefined && body.parentId !== null && typeof body.parentId !== 'string') throw new StateError('Invalid parent folder.');
    if (body.repositoryId !== undefined && typeof body.repositoryId !== 'string') throw new StateError('Invalid repository.');
    await ensureSchema();
    for (let attempt = 0; attempt < 10; attempt++) {
      const { state, revision } = await readState();
      const user = actor(state, userId);
      const parentId = body.parentId || null;
      let repositoryId = body.repositoryId || '';
      if (parentId) {
        const parent = state.folders.find(folder => folder.id === parentId);
        if (!parent) throw new StateError('The parent folder no longer exists. Reload and try again.', 409);
        repositoryId = parent.repositoryId || '';
      }
      const id = newId('folder');
      const folder = {
        id, name: body.name.trim(), parentId, repositoryId,
        description: typeof body.description === 'string' ? body.description.slice(0, 20000) : 'Directory folder',
        permissionLevel: body.permissionLevel, allowedRoles: body.allowedRoles,
        allowedUserIds: [], itemCount: 0, totalSize: 0, formattedSize: '0 KB',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: user.name,
      };
      if (!repositoryId || !state.repositories.some(repository => repository.id === repositoryId)) throw new StateError('Select a repository before creating a folder.');
      if (!writableDestination(state, user, repositoryId, parentId)) throw new StateError('You cannot write to that destination.', 403);
      const next = { ...state, folders: [...state.folders, folder] } as AppState;
      validateHierarchy(next);
      next.auditLogs = [{ id: newId('log'), action: 'FOLDER_CREATE', targetName: folder.name, targetType: 'folder', performedBy: user.name, role: user.role, timestamp: folder.createdAt, details: 'Created new folder directory', repositoryId }, ...state.auditLogs];
      next.repositories = next.repositories.map(repository => repository.id === repositoryId ? { ...repository, updatedAt: folder.updatedAt } : repository);
      const committed = await compareAndSwap(revision, next);
      if (committed !== null) return Response.json({ folder, state: visibleState(next, userId, committed) }, { status: 201, headers });
    }
    throw new StateError('Storage is busy. Try again.', 409);
  } catch (error) { return errorResponse(error); }
}
