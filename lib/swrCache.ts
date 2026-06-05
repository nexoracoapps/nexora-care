/**
 * Lightweight client-side stale-while-revalidate cache.
 * In-memory for fast access + localStorage for persistence across page refreshes.
 *
 * Usage in a load() function:
 *   const stale = swrGet<MyType[]>(url);
 *   if (stale) { setData(stale); setLoading(false); } else setLoading(true);
 *   const res = await fetch(url, ...);
 *   if (res.ok) { const d = await res.json(); setData(d); swrSet(url, d); }
 *   setLoading(false);
 *
 * After a mutation (create / delete) call swrBust('/api/endpoint') before load()
 * so stale data is not flashed back onto the screen.
 */

const MEM = new Map<string, { d: unknown; t: number }>();
const MEM_TTL = 45_000;       // 45 s — fast in-session navigation
const LS_TTL  = 5 * 60_000;   // 5 min — survives page refreshes
const LS_PREFIX = 'nxswr:';

// ── helpers ──────────────────────────────────────────────────────────────────

function lsKey(key: string) { return LS_PREFIX + key; }

function lsRead<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (!raw) return null;
    const entry: { d: T; t: number } = JSON.parse(raw);
    if (Date.now() - entry.t > LS_TTL) { localStorage.removeItem(lsKey(key)); return null; }
    return entry.d;
  } catch { return null; }
}

function lsWrite(key: string, data: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(lsKey(key), JSON.stringify({ d: data, t: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

function lsRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(lsKey(key)); } catch { /* ignore */ }
}

// ── public API ────────────────────────────────────────────────────────────────

export function swrGet<T>(key: string): T | null {
  // 1. In-memory hit (fastest path)
  const mem = MEM.get(key);
  if (mem && Date.now() - mem.t <= MEM_TTL) return mem.d as T;
  MEM.delete(key);

  // 2. localStorage fallback (survives page refresh)
  const ls = lsRead<T>(key);
  if (ls !== null) {
    MEM.set(key, { d: ls, t: Date.now() }); // warm memory cache
    return ls;
  }
  return null;
}

export function swrSet(key: string, data: unknown): void {
  MEM.set(key, { d: data, t: Date.now() });
  lsWrite(key, data);
}

/** Remove all cache entries whose key starts with `prefix`. */
export function swrBust(prefix: string): void {
  for (const k of MEM.keys()) if (k.startsWith(prefix)) MEM.delete(k);
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX + prefix)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/** Clear the entire cache (e.g. on logout). */
export function swrClear(): void {
  MEM.clear();
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
