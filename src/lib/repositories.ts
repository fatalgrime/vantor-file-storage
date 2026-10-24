import { VantorRepository } from './types';
import { StateError } from './mutations';

export const slugifyRepositoryName = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').slice(0, 120).replace(/^-|-$/g, '') || 'repository';
export function repositorySlug(repository: VantorRepository): string {
  const name = repository.name.trim().toLowerCase();
  if (name === 'subsidiary documents' || repository.id === 'repo-default') return 'sub-documents';
  if (name === 'harvesta') return 'harvesta';
  return repository.slug || slugifyRepositoryName(repository.name);
}
export const repositoryPath = (repository: VantorRepository) => `/dashboard/repositories/${encodeURIComponent(repositorySlug(repository))}`;
export const findRepositoryByRoute = (repositories: VantorRepository[], route: string) => repositories.find(r => repositorySlug(r) === route) || repositories.find(r => r.id === route);

export function assignRepositorySlugs(repositories: VantorRepository[]): VantorRepository[] {
  const reserved = new Set(['sub-documents', 'harvesta']);
  const used = new Set<string>();
  return repositories.map(repository => {
    const preferred = repositorySlug(repository);
    const forced = repository.id === 'repo-default' || ['subsidiary documents', 'harvesta'].includes(repository.name.trim().toLowerCase());
    let slug = preferred;
    if ((!forced && reserved.has(slug)) || used.has(slug)) {
      if (forced) throw new StateError(`More than one repository claims the slug "${slug}".`, 409);
      const suffix = slugifyRepositoryName(repository.id);
      slug = `${preferred}-${suffix}`;
      let count = 2;
      while (used.has(slug) || reserved.has(slug)) slug = `${preferred}-${suffix}-${count++}`;
    }
    used.add(slug);
    const { isDefault, default: defaultFlag, isDefaultRepository, ...rest } = repository as VantorRepository & Record<string, unknown>;
    return { ...rest, slug };
  });
}

// Preserve the ownership of old records once, rather than treating any
// repository as the implicit destination for new content.
export function migrateRepositoryConfiguration<T extends { repositories: VantorRepository[]; [key: string]: any }>(state: T): T {
  const rest = { ...state };
  delete rest.defaultRepositoryId;
  delete rest.defaultRepository;
  delete rest.defaultRepoId;
  const legacyExists = state.repositories.some(r => r.id === 'repo-default');
  const explicitOwner = (record: any) => legacyExists && !record.repositoryId ? { ...record, repositoryId: 'repo-default' } : record;
  const { defaultRepositoryId: settingsDefault, defaultRepository: settingsRepository, defaultRepoId: settingsRepoId, ...settings } = state.settings || {};
  return {
    ...rest, repositories: assignRepositorySlugs(state.repositories), settings,
    files: (state.files || []).map(explicitOwner), folders: (state.folders || []).map(explicitOwner),
    trash: (state.trash || []).map((entry: any) => ({ ...entry, record: entry.collection === 'files' || entry.collection === 'folders' ? explicitOwner(entry.record) : entry.collection === 'repositories' ? assignRepositorySlugs([entry.record])[0] : entry.record })),
    versions: (state.versions || []).map((entry: any) => ({ ...entry, record: explicitOwner(entry.record) })),
  } as T;
}
