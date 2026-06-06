const PATCH_KEY = 'nexora-pending-patches';

interface StoredPatch {
  action: string;
  fields: Record<string, unknown>;
  at: number;
}

function getAll(): Record<string, StoredPatch[]> {
  if (typeof localStorage === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(PATCH_KEY) || '{}'); }
  catch { return {}; }
}

export function savePatch(entityId: string, action: string, fields: Record<string, unknown>): void {
  if (typeof localStorage === 'undefined') return;
  const all = getAll();
  all[entityId] = [...(all[entityId] || []), { action, fields, at: Date.now() }];
  localStorage.setItem(PATCH_KEY, JSON.stringify(all));
}

export function applyStoredPatches<T extends { id: string }>(items: T[]): T[] {
  const all = getAll();
  if (!Object.keys(all).length) return items;
  return items.map(item => {
    const patches = all[item.id];
    if (!patches?.length) return item;
    return patches.reduce((acc, p) => ({ ...acc, ...p.fields }), item as object) as T;
  });
}

export function clearPatches(entityIds?: string[]): void {
  if (typeof localStorage === 'undefined') return;
  if (!entityIds) { localStorage.removeItem(PATCH_KEY); return; }
  const all = getAll();
  entityIds.forEach(id => delete all[id]);
  localStorage.setItem(PATCH_KEY, JSON.stringify(all));
}

export function getAllPatchedIds(): string[] {
  return Object.keys(getAll());
}
