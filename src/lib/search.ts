import { VantorFile, VantorFolder, VantorRepository } from './types';

export function matchesSearch(
  item: VantorFile | VantorFolder | VantorRepository,
  searchQuery: string,
): boolean {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;

  const values: unknown[] = [item.name, item.description, item.updatedAt];
  if ('fileType' in item) {
    values.push(item.originalName, item.category, item.fileType, item.extension,
      item.mimeType, item.uploadedBy, item.permissionLevel, ...(item.tags || []));
  } else {
    values.push(item.createdBy);
    if ('permissionLevel' in item) values.push(item.permissionLevel);
  }

  return values.some((value) => typeof value === 'string' && value.toLowerCase().includes(query));
}
