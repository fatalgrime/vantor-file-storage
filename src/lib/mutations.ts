export const collections = ['files', 'folders', 'repositories', 'users', 'announcements', 'comments', 'shares', 'auditLogs'] as const;
export type Collection = typeof collections[number];
export type RecordValue = { id: string; [key: string]: any };
export interface Mutation { collection: Collection; id: string; before: RecordValue | null; after: RecordValue | null }
export class StateError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a as object).sort();
  const other = Object.keys(b as object).sort();
  return keys.length === other.length && keys.every((key, i) => key === other[i] && equal((a as any)[key], (b as any)[key]));
};
export function diffCollections(base: any, patch: any): Mutation[] {
  const mutations: Mutation[] = [];
  for (const collection of collections) {
    if (!(collection in patch)) continue;
    if (!Array.isArray(patch[collection])) throw new StateError('Expected a list.');
    const before = new Map<string, RecordValue>((base[collection] || []).map((r: RecordValue) => [r.id, r]));
    const after = new Map<string, RecordValue>(patch[collection].map((r: RecordValue) => [r.id, r]));
    if (after.size !== patch[collection].length) throw new StateError('Duplicate record IDs.');
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const old = before.get(id) || null, next = after.get(id) || null;
      if (!equal(old, next)) mutations.push({ collection, id, before: old, after: next });
    }
  }
  return mutations;
}
export function applyMutations(state: any, mutations: Mutation[]): any {
  const result = { ...state };
  const seen = new Set<string>();
  for (const mutation of mutations) {
    if (!collections.includes(mutation.collection) || typeof mutation.id !== 'string' || !mutation.id || mutation.id.length > 200 || seen.has(`${mutation.collection}:${mutation.id}`)) throw new StateError('Invalid mutation.');
    seen.add(`${mutation.collection}:${mutation.id}`);
    const list: RecordValue[] = result[mutation.collection] || [];
    const current = list.find(r => r.id === mutation.id) || null;
    if (!equal(current, mutation.before)) throw new StateError('This item changed in another session. Reload and try again.', 409);
    if (mutation.after && mutation.after.id !== mutation.id) throw new StateError('Record ID cannot change.');
    result[mutation.collection] = mutation.after
      ? current ? list.map(r => r.id === mutation.id ? mutation.after : r) : [...list, mutation.after]
      : list.filter(r => r.id !== mutation.id);
  }
  return result;
}
