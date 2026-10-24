const fs = require('node:fs');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { repositoryPath, findRepositoryByRoute, assignRepositorySlugs, migrateRepositoryConfiguration } = require('../src/lib/repositories.ts');
const { INITIAL_REPOSITORIES } = require('../src/lib/db.ts');
const { repoFor, writableDestination } = require('../src/lib/server/policy.ts');
const repositories = [
  { id: 'repo-default', name: 'Subsidiary Documents', assignedRoles: ['member'], assignedUserIds: [], isDefault: true },
  { id: 'repo-12345', name: 'Harvesta', assignedRoles: ['member'], assignedUserIds: [] },
];
test('requested URLs use slugs while preserving the original repository IDs', () => {
  const configured = assignRepositorySlugs(repositories);
  assert.equal(repositoryPath(configured[0]), '/dashboard/repositories/sub-documents');
  assert.equal(repositoryPath(configured[1]), '/dashboard/repositories/harvesta');
  assert.equal(configured[0].id, 'repo-default');
  assert.equal(configured[0].isDefault, undefined);
  assert.equal(findRepositoryByRoute(configured, 'sub-documents').id, 'repo-default');
  assert.equal(findRepositoryByRoute(configured, 'harvesta').id, 'repo-12345');
  assert.equal(findRepositoryByRoute(configured, 'repo-default').slug, 'sub-documents');
  assert.equal(findRepositoryByRoute(configured, 'repo-12345').slug, 'harvesta');
});
test('migration removes default designations without moving or deleting existing content', () => {
  const input = { repositories, defaultRepositoryId: 'repo-default', settings: { theme: 'dark', defaultRepositoryId: 'repo-default' }, files: [{ id: 'legacy-file' }, { id: 'harvesta-file', repositoryId: 'repo-12345' }], folders: [{ id: 'legacy-folder' }], trash: [{ collection: 'files', record: { id: 'old-file' } }], versions: [{ record: { id: 'version-file' } }] };
  const state = migrateRepositoryConfiguration(input);
  assert.equal(state.defaultRepositoryId, undefined); assert.equal(state.settings.defaultRepositoryId, undefined);
  assert.equal(state.settings.theme, 'dark');
  assert.equal(state.files[0].repositoryId, 'repo-default');
  assert.equal(state.files[1].repositoryId, 'repo-12345');
  assert.equal(state.folders[0].repositoryId, 'repo-default');
  assert.equal(state.trash[0].record.repositoryId, 'repo-default');
  assert.equal(state.versions[0].record.repositoryId, 'repo-default');
  assert.deepEqual(migrateRepositoryConfiguration(state), state);
  assert.equal(input.files[0].repositoryId, undefined);
});
test('there is no seeded default and new content must select an explicit repository', () => {
  assert.deepEqual(INITIAL_REPOSITORIES, []);
  const state = { repositories: assignRepositorySlugs(repositories), files: [], folders: [] };
  assert.equal(repoFor(state, {}), undefined);
  assert.equal(writableDestination(state, { id: 'u', role: 'member' }, '', null), false);
  assert.equal(writableDestination(state, { id: 'u', role: 'member' }, 'repo-default', null), true);
});
test('slugs remain stable on rename and conflicting generic names receive unique URLs', () => {
  const configured = assignRepositorySlugs([{ id: 'one', name: 'Design' }, { id: 'two', name: 'Design' }, ...repositories]);
  assert.equal(new Set(configured.map(r => r.slug)).size, configured.length);
  const renamed = assignRepositorySlugs([{ ...configured[0], name: 'New Design Name' }])[0];
  assert.equal(renamed.slug, 'design');
});
