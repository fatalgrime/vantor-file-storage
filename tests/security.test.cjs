const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const test = require('node:test');
const assert = require('node:assert/strict');
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 }, fileName: filename }).outputText, filename);
};
const clone = value => JSON.parse(JSON.stringify(value));
let dbState, revision, signedIn = 'admin', uploadWrites, casFailures, sessions, cookieJar, uploads, attempts, quotaBytes, blobs;
const sql = async (strings, ...values) => {
  const query = strings.join('?').replace(/\s+/g, ' ').trim();
  if (query.startsWith('CREATE ') || query.startsWith('ALTER ')) return [];
  if (query.startsWith('INSERT INTO vantor_app_state') || query.startsWith('INSERT INTO vantor_storage_quota')) return [];
  if (query.startsWith('SELECT data, revision')) return [{ data: clone(dbState), revision }];
  if (query.startsWith('WITH uploads AS')) {
    const ids = JSON.parse(values[0]);
    if (revision !== values[2] || ids.some(id => !uploads.get(id)?.completed || uploads.get(id)?.attached)) return [];
    dbState = JSON.parse(values[1]); revision++;
    for (const id of ids) uploads.get(id).attached = true;
    return [{ revision }];
  }
  if (query.startsWith('WITH admitted AS')) {
    if (revision !== values[1]) return [];
    dbState = JSON.parse(values[0]); revision++;
    sessions.set(values[2], { shareId: values[3], expires: values[4], grant: values[5] });
    return [{ token_hash: values[2] }];
  }
  if (query.startsWith('UPDATE vantor_app_state')) {
    if (casFailures > 0) { casFailures--; revision++; return []; }
    if (revision !== values[1]) return [];
    dbState = JSON.parse(values[0]); return [{ revision: ++revision }];
  }
  if (query.startsWith('WITH reserved AS')) {
    if (quotaBytes + values[0] > values[2]) return [];
    quotaBytes += values[0];
    uploads.set(values[3], { file_id: values[3], owner_id: values[4], repository_id: values[5], folder_id: values[6], size: values[7], mime_type: values[8], completed: false }); return [{ file_id: values[3] }];
  }
  if (query.startsWith('UPDATE vantor_uploads')) { const upload = uploads.get(values[1]); upload.r2_key = values[0]; upload.completed = true; return []; }
  if (query.startsWith('INSERT INTO vantor_file_blobs')) { uploadWrites++; blobs.set(values[0], Buffer.from(values[3].slice(2), 'hex')); return []; }
  if (query.startsWith('INSERT INTO vantor_uploads')) { uploads.set(values[0], { file_id: values[0], owner_id: values[1], repository_id: values[2], folder_id: values[3], size: values[4], mime_type: values[5], r2_key: values[6] }); return []; }
  if (query.startsWith('SELECT * FROM vantor_uploads')) { const u = uploads.get(values[0]); return u?.owner_id === values[1] ? [u] : []; }
  if (query.startsWith('SELECT data FROM vantor_file_blobs')) return [{ data: blobs.get(values[0]) || Buffer.from('hello') }];
  if (query.startsWith('INSERT INTO vantor_share_sessions')) { sessions.set(values[0], { shareId: values[1], expires: values[2] }); return []; }
  if (query.startsWith('SELECT token_hash FROM vantor_share_sessions')) { const s = sessions.get(values[0]); return s && s.shareId === values[1] && s.grant === values[2] && Date.parse(s.expires) > Date.now() ? [{ token_hash: values[0] }] : []; }
  if (query.startsWith('INSERT INTO vantor_share_attempts')) return [{ attempts: ++attempts }];
  throw new Error('Unhandled test SQL: ' + query);
};
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
  if (name === '@neondatabase/serverless') return { neon: () => sql };
  if (name === '@clerk/nextjs/server') return { auth: async () => ({ userId: signedIn }), currentUser: async () => ({ id: signedIn, firstName: 'New', emailAddresses: [], imageUrl: '' }) };
  if (name === 'next/headers') return { cookies: async () => ({ get: key => cookieJar.has(key) ? { value: cookieJar.get(key) } : undefined, set: (key, value) => cookieJar.set(key, value) }) };
  if (name.endsWith('/r2') || name === '../r2') return { isR2Configured: () => false, uploadToR2: async () => { throw new Error('Unexpected R2 write'); }, readR2Object: async () => ({ Body: { transformToWebStream: () => new Blob(['hello']).stream() }, ContentLength: 5 }) };
  return originalLoad.call(this, name, parent, isMain);
};
process.env.DATABASE_URL = 'test-only';
const { initialState, hashPassword, verifyPassword } = require('../src/lib/server/store.ts');
const { actor, safeFile, visibleState, validateMutations, validateHierarchy } = require('../src/lib/server/policy.ts');
const { diffCollections, applyMutations } = require('../src/lib/mutations.ts');
const { isWithinFolder, checkShareCapacity } = require('../src/lib/server/shares.ts');
const stateRoute = require('../src/app/api/storage-state/route.ts');
const uploadRoute = require('../src/app/api/r2/upload/route.ts');
const shareRoute = require('../src/app/api/public/share/[shareId]/route.ts');
const fileRoute = require('../src/app/api/public/files/[fileId]/route.ts');
const downloadRoute = require('../src/app/api/r2/download/[fileId]/route.ts');
const recoveryRoute = require('../src/app/api/storage-state/recovery/route.ts');
const user = (id, role) => ({ id, role, name: id, email: id + '@test.invalid', locked: false, lastActive: '' });
const file = (id, extras = {}) => ({ id, name: id + '.txt', originalName: id + '.txt', mimeType: 'text/plain', size: 5, formattedSize: '5 B', fileType: 'Text', extension: 'txt', category: '', folderId: null, repositoryId: 'repo-default', description: '', tags: [], permissionLevel: 'authenticated', allowedRoles: [], allowedUserIds: [], createdAt: '2026-01-01', updatedAt: '2026-01-01', uploadedBy: 'admin', uploadedByRole: 'admin', downloadCount: 0, ...extras });
const folder = (id, parentId = null) => ({ id, name: id, parentId, repositoryId: 'repo-default', permissionLevel: 'authenticated', allowedRoles: [], allowedUserIds: [], createdAt: '', updatedAt: '', createdBy: 'admin' });
const props = (key, value) => ({ params: Promise.resolve({ [key]: value }) });
const request = (path, body, method = 'PATCH') => new Request('https://test.invalid' + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = mutations => stateRoute.PATCH(request('/api/storage-state', { mutations }));
const getFile = (id, query = '') => fileRoute.GET(new Request('https://test.invalid/api/public/files/' + id + query), props('fileId', id));
const shareId = 'share-54fa8915-363e-4339-882e-cebc1391d67c';
test.beforeEach(() => {
  dbState = clone(initialState); dbState.repositories = [{ id: 'repo-default', slug: 'sub-documents', name: 'Subsidiary Documents', description: '', createdAt: '', updatedAt: '', createdBy: 'admin', assignedRoles: ['admin', 'manager', 'member', 'viewer'], assignedUserIds: [] }]; dbState.users = [user('admin', 'admin'), user('member', 'member'), user('viewer', 'viewer')];
  dbState.files = [file('a'), file('private', { permissionLevel: 'private', content: 'SECRET' })];
  revision = 0; signedIn = 'admin'; uploadWrites = 0; casFailures = 0; sessions = new Map(); cookieJar = new Map(); uploads = new Map(); attempts = 0; quotaBytes = 0; blobs = new Map();
});
test('unknown accounts fail closed and registration assigns viewer on the server', async () => {
  assert.throws(() => actor(dbState, 'new'), /does not have access/);
  signedIn = 'new';
  assert.equal((await stateRoute.GET()).status, 200);
  assert.equal(dbState.users.find(u => u.id === 'new').role, 'viewer');
  const before = visibleState(dbState, 'new', revision).users[0];
  assert.equal((await patch([{ collection: 'users', id: 'new', before, after: { ...before, role: 'admin' } }])).status, 403);
});
test('locked accounts cannot read state, download files, or upload', async () => {
  dbState.users[0].locked = true;
  assert.equal((await stateRoute.GET()).status, 403);
  assert.equal((await getFile('a')).status, 403);
  assert.equal((await uploadRoute.POST(new Request('https://test.invalid/api/r2/upload?repositoryId=repo-default', { method: 'POST', body: 'x' }))).status, 403);
  assert.equal(uploadWrites, 0);
});
test('state responses filter private metadata, user lists, and share secrets', async () => {
  dbState.shares = [{ id: shareId, itemId: 'a', itemType: 'file', createdBy: 'member', passwordHash: hashPassword('secret'), allowDownload: true }];
  signedIn = 'member'; const payload = await (await stateRoute.GET()).json();
  assert.deepEqual(payload.files.map(f => f.id), ['a']);
  assert.deepEqual(payload.users.map(u => u.id), ['member']);
  assert.equal(payload.shares[0].hasPassword, true);
  assert.equal(payload.shares[0].passwordHash, undefined);
  assert.equal(payload.files[0].content, undefined);
  assert.equal(payload.files[0].url, '/api/public/files/a');
});
test('anonymous and unauthorized file access is denied, including arbitrary R2 keys', async () => {
  signedIn = null; assert.equal((await getFile('a')).status, 401);
  signedIn = 'member'; assert.equal((await getFile('private')).status, 404);
  const response = await downloadRoute.GET(new Request('https://test.invalid/api/r2/download/private?r2Key=anything'), props('fileId', 'private'));
  assert.equal(response.status, 404);
});
test('file responses use private caching, sandboxing, attachment policy, and byte ranges', async () => {
  const response = await fileRoute.GET(new Request('https://test.invalid/api/public/files/a?download=1', { headers: { Range: 'bytes=1-3' } }), props('fileId', 'a'));
  assert.equal(response.status, 206); assert.equal(await response.text(), 'ell');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('content-security-policy'), /sandbox/);
  assert.match(response.headers.get('content-disposition'), /attachment/);
});
test('authorization happens before upload reads or blob writes and viewers cannot upload', async () => {
  signedIn = 'viewer';
  assert.equal((await uploadRoute.POST(new Request('https://test.invalid/api/r2/upload?repositoryId=repo-default', { method: 'POST', body: 'hello' }))).status, 403);
  assert.equal(uploadWrites, 0);
  const response = await patch([{ collection: 'files', id: 'a', before: safeFile(dbState.files[0]), after: { ...safeFile(dbState.files[0]), content: 'data:text/plain;base64,eA==' } }]);
  assert.equal(response.status, 403); assert.equal(uploadWrites, 0);
});
test('administrators can publish announcements and non-admins cannot publish or change them', async () => {
  const announcement = { id: 'announcement-1', title: 'Maintenance', content: 'Scheduled maintenance', type: 'info', isActive: true, createdAt: '2026-01-01', createdBy: 'admin' };
  assert.equal((await patch([{ collection: 'announcements', id: announcement.id, before: null, after: announcement }])).status, 200);
  assert.deepEqual(dbState.announcements, [announcement]);
  signedIn = 'member';
  const secondAnnouncement = { ...announcement, id: 'announcement-2' };
  assert.equal((await patch([{ collection: 'announcements', id: secondAnnouncement.id, before: null, after: secondAnnouncement }])).status, 403);
  assert.equal((await patch([{ collection: 'announcements', id: announcement.id, before: announcement, after: { ...announcement, isActive: false } }])).status, 403);
  assert.equal(dbState.announcements[0].isActive, true);
});
test('upload size is enforced before buffering and IDs are generated by the server', async () => {
  const tooBig = new Request('https://test.invalid/api/r2/upload?repositoryId=repo-default', { method: 'POST', headers: { 'Content-Length': String(51 * 1024 * 1024) }, body: 'small' });
  assert.equal((await uploadRoute.POST(tooBig)).status, 413);
  const response = await uploadRoute.POST(new Request('https://test.invalid/api/r2/upload?repositoryId=repo-default&fileId=a', { method: 'POST', headers: { 'X-File-Name': 'new.txt', 'Content-Type': 'text/plain' }, body: 'hello' }));
  assert.equal(response.status, 200); const data = await response.json();
  assert.match(data.fileId, /^file-[a-f0-9-]{36}$/); assert.notEqual(data.fileId, 'a');
  assert.equal(uploadWrites, 1);
  signedIn = 'member';
  assert.equal((await patch([{ collection: 'files', id: data.fileId, before: null, after: file(data.fileId) }])).status, 403);
});
test('non-admin editors cannot change private users or collaborators, even in default repository', () => {
  const before = safeFile(dbState.files[0]);
  for (const changes of [{ allowedUserIds: ['viewer'] }, { collaborators: [{ userId: 'viewer', role: 'editor' }] }, { permissionLevel: 'public' }]) {
    assert.throws(() => validateMutations(dbState, 'member', [{ collection: 'files', id: 'a', before, after: { ...before, ...changes } }]), /administrators/);
  }
});
test('record mutations preserve unrelated concurrent edits, reject stale edits, and retry CAS collisions', async () => {
  const before = safeFile(dbState.files[0]);
  dbState.files[1].description = 'other session'; casFailures = 1;
  const response = await patch([{ collection: 'files', id: 'a', before, after: { ...before, description: 'my edit' } }]);
  assert.equal(response.status, 200);
  assert.equal(dbState.files[1].description, 'other session');
  assert.equal((await patch([{ collection: 'files', id: 'a', before, after: { ...before, description: 'stale edit' } }])).status, 409);
  assert.equal(dbState.files[0].description, 'my edit');
});
test('diffs identify individual records and conflicts do not mutate the source', () => {
  const base = { files: [file('a'), file('b')] };
  const operations = diffCollections(base, { files: [file('a', { name: 'renamed' }), file('b')] });
  assert.equal(operations.length, 1);
  assert.equal(applyMutations(base, operations).files[0].name, 'renamed');
  assert.equal(base.files[0].name, 'a.txt');
  assert.throws(() => applyMutations(base, [...operations, ...operations]), /Invalid mutation/);
});
test('cyclic folders and cross-repository parents are rejected and share traversal terminates', () => {
  dbState.folders = [folder('x', 'y'), folder('y', 'x')];
  assert.throws(() => validateHierarchy(dbState), /cycle/);
  assert.equal(isWithinFolder('x', 'outside', dbState), false);
  dbState.folders = [{ ...folder('x'), repositoryId: 'elsewhere' }]; dbState.files[0].folderId = 'x';
  assert.throws(() => validateHierarchy(dbState), /same repository|does not exist/);
});
test('share passwords are salted hashes and incorrect attempts do not grant a session', async () => {
  const hash = hashPassword('correct'); assert.notEqual(hash, hashPassword('correct'));
  assert.equal(verifyPassword('correct', hash), true); assert.equal(verifyPassword('wrong', hash), false);
  dbState.shares = [{ id: shareId, itemId: 'a', itemType: 'file', passwordHash: hash, allowDownload: true }];
  const response = await shareRoute.POST(request('/api/public/share/' + shareId, { password: 'wrong' }, 'POST'), props('shareId', shareId));
  assert.equal(response.status, 401); assert.equal(sessions.size, 0);
});
test('share passwords in query strings never authenticate and expired shares deny content', async () => {
  dbState.shares = [{ id: shareId, itemId: 'a', itemType: 'file', passwordHash: hashPassword('correct'), allowDownload: true }];
  const response = await shareRoute.GET(new Request('https://test.invalid/api/public/share/' + shareId + '?password=correct'), props('shareId', shareId));
  assert.equal((await response.json()).passwordRequired, true); assert.equal(sessions.size, 0);
  dbState.shares[0].expiresAt = '2020-01-01';
  signedIn = null; assert.equal((await getFile('a', '?shareId=' + shareId)).status, 410);
});
test('one-time admission is atomic; its session can preview but cannot bypass disabled downloads', async () => {
  dbState.shares = [{ id: shareId, itemId: 'a', itemType: 'file', oneTimeOnly: true, allowDownload: false, viewsCount: 0 }];
  signedIn = null;
  const response = await shareRoute.POST(request('/api/public/share/' + shareId, {}, 'POST'), props('shareId', shareId));
  assert.equal(response.status, 200);
  assert.equal(dbState.shares[0].accessCount, 1); assert.equal(dbState.shares[0].selfDestructed, true);
  assert.equal((await getFile('a', '?shareId=' + shareId)).status, 200);
  assert.equal((await getFile('a', '?shareId=' + shareId + '&download=1')).status, 403);
  assert.equal((await getFile('private', '?shareId=' + shareId)).status, 403);
  cookieJar.clear();
  assert.equal((await shareRoute.POST(request('/api/public/share/' + shareId, {}, 'POST'), props('shareId', shareId))).status, 410);
});
test('concurrent one-time requests admit only one session and access limits are enforced', async () => {
  dbState.shares = [{ id: shareId, itemId: 'a', itemType: 'file', oneTimeOnly: true, allowDownload: true }];
  const responses = await Promise.all([1, 2].map(() => shareRoute.POST(request('/api/public/share/' + shareId, {}, 'POST'), props('shareId', shareId))));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 410]);
  assert.equal(sessions.size, 1);
  assert.throws(() => checkShareCapacity({ maxAccessCount: 2, accessCount: 2 }), /access limit/);
});
test('deleted folders cascade to nested content and recovery restores the complete group', async () => {
  dbState.folders = [folder('root'), folder('nested', 'root')]; dbState.files[0].folderId = 'nested';
  const response = await patch([{ collection: 'folders', id: 'root', before: clone(dbState.folders[0]), after: null }]);
  assert.equal(response.status, 200); assert.equal(dbState.folders.length, 0);
  assert.equal(dbState.files.some(f => f.id === 'a'), false);
  assert.equal(dbState.trash.length, 3);
  const restore = await recoveryRoute.POST(request('/api/storage-state/recovery', { kind: 'trash', id: dbState.trash[0].id }, 'POST'));
  assert.equal(restore.status, 200); assert.equal(dbState.folders.length, 2); assert.equal(dbState.files[0].folderId, null); assert.equal(dbState.files.find(f => f.id === 'a').folderId, 'nested');
});
test('metadata history is restorable and audit identity comes from the authenticated user', async () => {
  const before = safeFile(dbState.files[0]);
  assert.equal((await patch([{ collection: 'files', id: 'a', before, after: { ...before, name: 'renamed.txt' } }])).status, 200);
  assert.equal(dbState.versions.length, 1); assert.equal(dbState.auditLogs[0].performedBy, 'admin');
  assert.equal((await recoveryRoute.POST(request('/api/storage-state/recovery', { kind: 'versions', id: dbState.versions[0].id }, 'POST'))).status, 200);
  assert.equal(dbState.files.find(f => f.id === 'a').name, 'a.txt');
  signedIn = 'viewer';
  assert.equal((await recoveryRoute.POST(request('/api/storage-state/recovery', { kind: 'versions', id: dbState.versions[0].id }, 'POST'))).status, 403);
});
test('streamed upload size limits cannot be bypassed by omitting content-length', async () => {
  const chunk = new Uint8Array(26 * 1024 * 1024); let sent = 0;
  const stream = new ReadableStream({ pull(controller) { if (sent++ < 2) controller.enqueue(chunk); else controller.close(); } });
  const response = await uploadRoute.POST(new Request('https://test.invalid/api/r2/upload?repositoryId=repo-default', { method: 'POST', body: stream, duplex: 'half' }));
  assert.equal(response.status, 413); assert.equal(uploadWrites, 0); assert.equal(quotaBytes, 0);
});
test('concurrent uploads cannot overrun storage quota, including unattached uploads', async () => {
  quotaBytes = 50 * 1024 * 1024 * 1024 - 5;
  const results = await Promise.all([1, 2].map(() => uploadRoute.POST(new Request('https://test.invalid/api/r2/upload?repositoryId=repo-default', { method: 'POST', body: 'hello' }))));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 413]);
  assert.equal(quotaBytes, 50 * 1024 * 1024 * 1024); assert.equal(uploadWrites, 1);
});
test('an uploader can attach completed content, while inline and unowned blobs cannot be substituted', async () => {
  const upload = await uploadRoute.POST(new Request('https://test.invalid/api/r2/upload?repositoryId=repo-default', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello' }));
  const data = await upload.json();
  const result = await patch([{ collection: 'files', id: data.fileId, before: null, after: file(data.fileId) }]);
  assert.equal(result.status, 200);
  assert.equal(dbState.files.find(f => f.id === data.fileId).url, '/api/public/files/' + data.fileId);
  const before = safeFile(dbState.files.find(f => f.id === data.fileId));
  assert.equal((await patch([{ collection: 'files', id: data.fileId, before, after: { ...before, url: 'https://attacker.invalid/content' } }])).status, 400);
});
test('malformed collaborator payloads cannot corrupt stored authorization records', async () => {
  const before = safeFile(dbState.files[0]);
  const response = await patch([{ collection: 'files', id: 'a', before, after: { ...before, collaborators: { some: 'broken' } } }]);
  assert.equal(response.status, 400); assert.equal(dbState.files[0].collaborators, undefined);
});
test('password changes and revocation invalidate previously admitted share sessions', async () => {
  dbState.shares = [{ id: shareId, itemId: 'a', itemType: 'file', passwordHash: hashPassword('first'), allowDownload: true }];
  signedIn = null;
  assert.equal((await shareRoute.POST(request('/api/public/share/' + shareId, { password: 'first' }, 'POST'), props('shareId', shareId))).status, 200);
  assert.equal((await getFile('a', '?shareId=' + shareId)).status, 200);
  dbState.shares[0].passwordHash = hashPassword('second');
  assert.equal((await getFile('a', '?shareId=' + shareId)).status, 401);
  dbState.shares = [];
  assert.equal((await getFile('a', '?shareId=' + shareId)).status, 404);
});
test('visit counters do not prevent a share owner from revoking an active link', async () => {
  dbState.shares = [{ id: shareId, itemId: 'a', itemType: 'file', createdBy: 'admin', allowDownload: true, viewsCount: 0 }];
  const before = visibleState(dbState, 'admin', revision).shares[0];
  dbState.shares[0].viewsCount = 10;
  assert.equal((await patch([{ collection: 'shares', id: shareId, before, after: null }])).status, 200);
  assert.equal(dbState.shares.length, 0);
});
test('folder subtrees can move between authorized repositories as one operation', async () => {
  dbState.repositories.push({ ...clone(dbState.repositories[0]), id: 'repo-target', slug: 'target', name: 'Target' });
  dbState.folders = [folder('root'), folder('child', 'root')];
  dbState.files[0].folderId = 'child';
  const mutations = dbState.folders.map(f => ({ collection: 'folders', id: f.id, before: clone(f), after: { ...f, repositoryId: 'repo-target' } }));
  const before = safeFile(dbState.files[0]);
  mutations.push({ collection: 'files', id: 'a', before, after: { ...before, repositoryId: 'repo-target' } });
  const response = await patch(mutations);
  assert.equal(response.status, 200);
  assert.equal(dbState.files.find(f => f.id === 'a').repositoryId, 'repo-target');
  assert.equal(dbState.folders.find(f => f.id === 'child').parentId, 'root');
});
test('moving content into an unassigned repository is denied', async () => {
  dbState.repositories.push({ ...clone(dbState.repositories[0]), id: 'repo-private', slug: 'private', name: 'Private', assignedRoles: [], assignedUserIds: [] });
  signedIn = 'member'; const before = safeFile(dbState.files[0]);
  assert.equal((await patch([{ collection: 'files', id: 'a', before, after: { ...before, repositoryId: 'repo-private' } }])).status, 403);
});
test('repository timestamp updates do not conflict with unrelated content saves', async () => {
  const beforeRepo = clone(dbState.repositories[0]);
  dbState.repositories[0].updatedAt = 'another-session';
  const before = safeFile(dbState.files[0]);
  assert.equal((await patch([
    { collection: 'repositories', id: beforeRepo.id, before: beforeRepo, after: { ...beforeRepo, updatedAt: 'local' } },
    { collection: 'files', id: 'a', before, after: { ...before, description: 'mine' } },
  ])).status, 200);
});
test('new content versions keep the logical ID, retain old bytes, and can be restored', async () => {
  dbState.files[0].content = 'original content';
  const upload = await uploadRoute.POST(new Request('https://test.invalid/api/r2/upload?repositoryId=repo-default', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'replacement bytes' }));
  const { fileId: uploadId } = await upload.json();
  const before = safeFile(dbState.files[0]);
  const result = await patch([{ collection: 'files', id: 'a', before, after: { ...before, uploadId, size: 17 } }]);
  assert.equal(result.status, 200);
  assert.equal(dbState.files[0].id, 'a'); assert.equal(dbState.files[0].storageId, uploadId);
  assert.equal(await (await getFile('a')).text(), 'replacement bytes');
  assert.equal(dbState.versions[0].kind, 'content'); assert.equal(dbState.versions[0].record.content, 'original content');
  const view = await result.json(); assert.equal(view.files[0].storageId, undefined);
  assert.equal(view.versions[0].record.content, undefined);
  // A later metadata update must retain the current physical blob reference.
  const current = safeFile(dbState.files[0]);
  assert.equal((await patch([{ collection: 'files', id: 'a', before: current, after: { ...current, description: 'changed metadata' } }])).status, 200);
  assert.equal(await (await getFile('a')).text(), 'replacement bytes');
  const restore = await recoveryRoute.POST(request('/api/storage-state/recovery', { kind: 'versions', id: dbState.versions[0].id }, 'POST'));
  assert.equal(restore.status, 200); assert.equal(await (await getFile('a')).text(), 'original content');
});
test('completed uploads cannot be attached twice or used to recreate trashed IDs', async () => {
  const upload = await uploadRoute.POST(new Request('https://test.invalid/api/r2/upload?repositoryId=repo-default', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' }));
  const data = await upload.json();
  const before = safeFile(dbState.files[0]);
  assert.equal((await patch([{ collection: 'files', id: 'a', before, after: { ...before, uploadId: data.fileId, size: 1 } }])).status, 200);
  const current = safeFile(dbState.files[0]);
  assert.equal((await patch([{ collection: 'files', id: 'a', before: current, after: { ...current, uploadId: data.fileId } }])).status, 409);
  assert.equal((await patch([{ collection: 'files', id: data.fileId, before: null, after: file(data.fileId) }])).status, 409);
});
test('uploads require an explicit repository even when the legacy repository exists', async () => {
  const response = await uploadRoute.POST(new Request('https://test.invalid/api/r2/upload', { method: 'POST', body: 'hello' }));
  assert.equal(response.status, 403);
  assert.equal(uploadWrites, 0);
});
