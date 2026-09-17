import { canReadItem, hasRepositoryAccess } from './authorization';
import { matchesSearch } from './search';
import { UserRole, VantorFile, VantorFolder, VantorRepository } from './types';

export interface SearchResult {
  item: VantorFile | VantorFolder | VantorRepository;
  kind: 'file' | 'folder' | 'repository';
  repository: VantorRepository;
  path: string;
}

export function getSearchResults(query: string, repositories: VantorRepository[], files: VantorFile[], folders: VantorFolder[], role: UserRole, userId: string): SearchResult[] {
  if (!query.trim()) return [];
  const accessible = new Map(repositories.filter((repo) => hasRepositoryAccess(role, userId, repo, files, folders)).map((repo) => [repo.id, repo]));
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const results: SearchResult[] = [];
  for (const repository of accessible.values()) {
    if (matchesSearch(repository, query)) results.push({ item: repository, kind: 'repository', repository, path: 'Repository' });
  }
  for (const item of [...folders, ...files]) {
    const repository = accessible.get(item.repositoryId || 'repo-default');
    if (!repository || !canReadItem(role, userId, item, folders, repository) || !matchesSearch(item, query)) continue;
    const parts: string[] = [];
    const seen = new Set<string>();
    let parentId = 'parentId' in item ? item.parentId : item.folderId;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = folderMap.get(parentId);
      if (!parent || (parent.repositoryId || 'repo-default') !== repository.id) break;
      parts.unshift(canReadItem(role, userId, parent, folders, repository) ? parent.name : 'Restricted folder');
      parentId = parent.parentId;
    }
    results.push({ item, kind: 'parentId' in item ? 'folder' : 'file', repository, path: [repository.name, ...parts].join(' / ') });
  }
  return results.sort((a, b) => a.item.name.localeCompare(b.item.name));
}
