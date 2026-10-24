const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const copy = x => JSON.parse(JSON.stringify(x));
const base = () => ({ files: [{ id: 'a', name: 'original', description: '', updatedAt: 'old' }, { id: 'b', name: 'other', description: '' }], auditLogs: [], settings: { theme: 'dark' } });
// The hook's queue runs independently of React rendering. Stub the two primitive
// hooks to inspect state transitions while testing real fetch/save/reload logic.
function harness(fetch) {
  const filename = path.resolve('src/hooks/useStorageState.ts');
  const localRequire = Module.createRequire(filename), exports = {}, states = [], rendered = [];
  const requireWithHooks = name => name === 'react' ? { useRef: value => ({ current: value }), useState: value => [value, next => states.push(next)] } : localRequire(name);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: requireWithHooks, fetch });
  const hook = exports.useStorageState(state => rendered.push(copy(state)));
  hook.initialize(base());
  return { ...hook, states, rendered };
}
test('queued edits use the confirmed server record and retain both local changes', async () => {
  let current = base(); const requests = [];
  const h = harness(async (_url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    for (const m of body.mutations) current.files = current.files.map(f => f.id === m.id ? { ...m.after, updatedAt: 'server-' + requests.length } : f);
    return Response.json(copy(current));
  });
  const first = copy(base().files); first[0].name = 'renamed'; first[0].updatedAt = 'local';
  const second = copy(first); second[0].description = 'new description';
  await Promise.all([h.persistState({ files: first }), h.persistState({ files: second })]);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].mutations[0].before.updatedAt, 'server-1');
  assert.equal(current.files[0].name, 'renamed'); assert.equal(current.files[0].description, 'new description');
  assert.equal(h.rendered.at(-1).files[0].description, 'new description');
  assert.equal(h.states.at(-1), 'saved');
});
test('conflicts roll back optimistic state and cancel dependent queued writes', async () => {
  const latest = base(); latest.files[0].name = 'external edit'; let writes = 0;
  const h = harness(async (_url, options) => {
    if (!options?.method) return Response.json(latest);
    writes++; return Response.json({ error: 'Conflict detected' }, { status: 409 });
  });
  const first = copy(base().files); first[0].name = 'my edit';
  const second = copy(first); second[0].description = 'dependent';
  const results = await Promise.allSettled([h.persistState({ files: first }), h.persistState({ files: second })]);
  assert.deepEqual(results.map(r => r.status), ['rejected', 'rejected']);
  assert.equal(writes, 1);
  assert.equal(h.rendered.at(-1).files[0].name, 'external edit');
  assert.ok(h.states.includes('failed'));
});
test('offline saves restore the last confirmed snapshot even when reload is unavailable', async () => {
  const h = harness(async () => { throw new Error('Offline'); });
  const files = copy(base().files); files[0].name = 'unsaved';
  await assert.rejects(h.persistState({ files }), /Offline/);
  assert.equal(h.rendered.at(-1).files[0].name, 'original');
});
test('queued changes cannot silently replace an external edit learned from an earlier response', async () => {
  let writes = 0; const latest = base(); latest.files[1].name = 'external edit';
  const h = harness(async (_url, options) => {
    if (!options?.method) return Response.json(latest);
    writes++; return Response.json(latest);
  });
  const first = copy(base().files); first[0].description = 'my first change';
  const second = copy(first); second[1].name = 'my stale name';
  const results = await Promise.allSettled([h.persistState({ files: first }), h.persistState({ files: second })]);
  assert.equal(results[1].status, 'rejected'); assert.equal(writes, 1);
  assert.equal(h.rendered.at(-1).files[1].name, 'external edit');
});
test('deleting a record after a newly learned external edit is rejected', async () => {
  let writes = 0; const latest = base(); latest.files[1].description = 'external edit';
  const h = harness(async () => { writes++; return Response.json(latest); });
  const first = copy(base().files); first[0].description = 'mine';
  const results = await Promise.allSettled([h.persistState({ files: first }), h.persistState({ files: [first[0]] })]);
  assert.equal(results[1].status, 'rejected');
  // One write and one reload, never a delete request.
  assert.equal(writes, 2); assert.equal(h.rendered.at(-1).files.length, 2);
});
