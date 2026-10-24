const fs = require('node:fs');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Run the repository's TypeScript modules without an additional test dependency.
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}
const { getSearchResults } = require('../src/lib/searchResults.ts');
const { canReadItem } = require('../src/lib/authorization.ts');
const { FileBrowser } = require('../src/components/FileBrowser.tsx');
const { SearchResults } = require('../src/components/SearchResults.tsx');
const { Pagination } = require('../src/components/Pagination.tsx');
const repo = { id: 'repo-default', name: 'Design', description: '', assignedRoles: ['member'], assignedUserIds: [] };
const folder = (id, overrides = {}) => ({ id, repositoryId: 'repo-default', name: id, parentId: null, description: '', permissionLevel: 'authenticated', allowedRoles: [], createdBy: 'User', formattedSize: '0 B', totalSize: 0, ...overrides });
const file = (id, overrides = {}) => ({ id, repositoryId: 'repo-default', name: id, folderId: null, description: '', tags: [], fileType: 'PDF Document', extension: 'pdf', permissionLevel: 'authenticated', allowedRoles: [], formattedSize: '0 B', size: 0, ...overrides });

test('search finds nested files with a complete repository path and ignores case/whitespace', () => {
  const folders = [folder('Brand'), folder('Guidelines', { parentId: 'Brand' })];
  const results = getSearchResults(' LOGO ', [repo], [file('Logo.pdf', { folderId: 'Guidelines' })], folders, 'member', 'u1');
  assert.equal(results.length, 1);
  assert.equal(results[0].kind, 'file');
  assert.equal(results[0].path, 'Design / Brand / Guidelines');
});
test('search excludes inaccessible repositories and private files', () => {
  const otherRepo = { ...repo, id: 'private-repo', assignedRoles: [] };
  const results = getSearchResults('secret', [repo, otherRepo], [file('secret.pdf', { permissionLevel: 'private' }), file('secret2.pdf', { repositoryId: 'private-repo' })], [], 'member', 'u1');
  assert.deepEqual(results, []);
});
test('directly invited collaborators can find and preview their file', () => {
  const privateRepo = { ...repo, assignedRoles: [] };
  const invitedFile = file('invited.pdf', { permissionLevel: 'private', collaborators: [{ userId: 'u1', role: 'viewer' }] });
  assert.equal(getSearchResults('invited', [privateRepo], [invitedFile], [], 'viewer', 'u1').length, 1);
  assert.equal(canReadItem('viewer', 'u1', invitedFile, [], privateRepo), true);
  assert.equal(canReadItem('viewer', 'u2', invitedFile, [], privateRepo), false);
});
test('search does not expose restricted ancestor names', () => {
  const hidden = folder('Secret project', { permissionLevel: 'private' });
  const result = getSearchResults('public.pdf', [repo], [file('public.pdf', { folderId: hidden.id })], [hidden], 'member', 'u1')[0];
  assert.equal(result.path, 'Design / Restricted folder');
});
test('circular folder references terminate safely', () => {
  const folders = [folder('A', { parentId: 'B' }), folder('B', { parentId: 'A' })];
  assert.equal(getSearchResults('report', [repo], [file('report.pdf', { folderId: 'A' })], folders, 'member', 'u1').length, 1);
});
test('blank search produces no global result list and metadata matches work', () => {
  assert.deepEqual(getSearchResults(' ', [repo], [], [], 'member', 'u1'), []);
  assert.equal(getSearchResults('finance', [repo], [file('report.pdf', { tags: ['Finance'] })], [], 'member', 'u1').length, 1);
});
const noop = () => {};
const browserProps = { folders: [], files: [], selectedIds: [], onToggleSelect: noop, onToggleSelectAll: noop, onOpenFolder: noop, onPreviewFile: noop, onDownloadFile: noop, onCopyLink: noop, onEditItem: noop, onManagePermissions: noop, onDeleteItem: noop, onMoveItem: noop, viewMode: 'list', currentRole: 'member', canEdit: () => true, canDelete: false, canManagePermissions: () => true };
const renderBrowser = (props) => renderToStaticMarkup(React.createElement(FileBrowser, { ...browserProps, ...props }));
test('loading, empty folder, and no matches have distinct messages in both layouts', () => {
  for (const viewMode of ['list', 'grid']) {
    assert.match(renderBrowser({ viewMode, loading: true }), /Loading files and folders/);
    assert.match(renderBrowser({ viewMode }), /This folder is empty/);
    const html = renderBrowser({ viewMode, emptyMessage: 'No matches', onClearFilters: noop });
    assert.match(html, /No matches/);
    assert.match(html, /Clear search and filters/);
  }
});
test('both layouts render at most 50 combined files and folders', () => {
  const folders = Array.from({ length: 30 }, (_, i) => folder(`folder-${String(i).padStart(3, '0')}`));
  const files = Array.from({ length: 75 }, (_, i) => file(`file-${String(i).padStart(3, '0')}.pdf`));
  for (const viewMode of ['list', 'grid']) {
    const html = renderBrowser({ folders, files, viewMode });
    assert.equal((html.match(/aria-label="Actions for /g) || []).length, 50);
    assert.match(html, /file-019.pdf/);
    assert.doesNotMatch(html, /file-020.pdf/);
    assert.match(html, /of 105 items/);
    assert.match(html, /Select page/);
  }
});
test('page selection reflects selected IDs rather than equal counts', () => {
  assert.match(renderBrowser({ files: [file('a.pdf')], selectedIds: ['unrelated'] }), /Select page/);
  assert.match(renderBrowser({ files: [file('a.pdf')], selectedIds: ['a.pdf'] }), /Deselect page/);
});
test('global search results render paths and paginate', () => {
  const results = getSearchResults('file-', [repo], Array.from({ length: 80 }, (_, i) => file(`file-${String(i).padStart(3, '0')}`)), [], 'member', 'u1');
  const html = renderToStaticMarkup(React.createElement(SearchResults, { results, onOpen: noop, onClear: noop }));
  assert.equal((html.match(/<li>/g) || []).length, 50);
  assert.match(html, /Design/);
  assert.match(html, /80 search results/);
});
test('pagination describes the last partial page', () => {
  const html = renderToStaticMarkup(React.createElement(Pagination, { page: 3, total: 105, onChange: noop }));
  assert.match(html, /101–105 of 105/);
  assert.match(html, /disabled="">Next/);
});
