const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
function harness() {
  let xhr;
  class Xhr {
    constructor() { xhr = this; this.upload = {}; this.headers = {}; }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(key, value) { this.headers[key] = value; }
    send(blob) { this.blob = blob; }
    abort() { this.onabort(); }
  }
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/lib/upload.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, XMLHttpRequest: Xhr, URLSearchParams, DOMException });
  return { uploadFile: exports.uploadFile, xhr: () => xhr };
}
test('uploads report progress, send raw bytes, and use the authorized destination', async () => {
  const h = harness(), progress = [], blob = new Blob(['hello'], { type: 'text/plain' });
  const promise = h.uploadFile(blob, 'hello world.txt', 'repo-private', 'folder-a', new AbortController().signal, value => progress.push(value));
  const xhr = h.xhr();
  assert.match(xhr.url, /repositoryId=repo-private/); assert.match(xhr.url, /folderId=folder-a/);
  assert.equal(xhr.blob, blob); assert.equal(xhr.headers['X-File-Name'], 'hello%20world.txt');
  xhr.upload.onprogress({ lengthComputable: true, loaded: 3, total: 5 });
  xhr.status = 200; xhr.responseText = JSON.stringify({ fileId: 'server-id', url: '/protected', size: 5 }); xhr.onload();
  assert.equal((await promise).fileId, 'server-id'); assert.deepEqual(progress, [60]);
});
test('cancelling an upload aborts the request and rejects with a retryable error', async () => {
  const h = harness(), controller = new AbortController();
  const promise = h.uploadFile(new Blob(['x']), 'x', 'repo-default', null, controller.signal, () => {});
  controller.abort();
  await assert.rejects(promise, error => error.name === 'AbortError');
});
test('HTTP failures and network failures reject instead of silently saving inline content', async () => {
  const h = harness();
  let promise = h.uploadFile(new Blob(['x']), 'x', 'repo-default', null, new AbortController().signal, () => {});
  h.xhr().status = 403; h.xhr().responseText = JSON.stringify({ error: 'No upload permission' }); h.xhr().onload();
  await assert.rejects(promise, /No upload permission/);
  promise = h.uploadFile(new Blob(['x']), 'x', 'repo-default', null, new AbortController().signal, () => {});
  h.xhr().onerror(); await assert.rejects(promise, /connection and retry/);
});
