export interface SavedStreaks {
  timezone: string; solves: Record<string, string>; cursor: string | null; complete: boolean;
  finished?: boolean; hasGaps?: boolean; processed?: number; total?: number; incompleteReason?: string;
}

const memory = new Map<string, SavedStreaks>();
const key = (owner: string, csesUserId: string) => `cses_official_streak_${owner}_${csesUserId}`;
if (typeof window !== 'undefined') window.addEventListener('cses-storage-cleared', () => memory.clear());

export function readOfficialStreaks(owner: string, csesUserId: string): SavedStreaks {
  const storageKey = key(owner, csesUserId);
  try {
    const value = typeof localStorage === 'undefined' ? null : localStorage.getItem(storageKey);
    if (value) {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && parsed.solves && typeof parsed.solves === 'object' && typeof parsed.timezone === 'string') {
        try {
          new Intl.DateTimeFormat('en', { timeZone: parsed.timezone });
          const solves: Record<string, string> = {};
          for (const [id, date] of Object.entries(parsed.solves)) if (id && typeof date === 'string' && Number.isFinite(Date.parse(date)) && Date.parse(date) <= Date.now()) solves[id] = date;
          return { timezone: parsed.timezone, solves, cursor: typeof parsed.cursor === 'string' ? parsed.cursor : null, complete: parsed.complete === true,
            ...(typeof parsed.finished === 'boolean' ? { finished: parsed.finished } : {}), ...(typeof parsed.hasGaps === 'boolean' ? { hasGaps: parsed.hasGaps } : {}),
            ...(Number.isFinite(parsed.processed) ? { processed: parsed.processed } : {}), ...(Number.isFinite(parsed.total) ? { total: parsed.total } : {}), ...(typeof parsed.incompleteReason === 'string' ? { incompleteReason: parsed.incompleteReason } : {}) };
        } catch { /* Reset invalid timezone. */ }
      }
    }
  } catch { /* Use memory when browser storage is unavailable. */ }
  const value = memory.get(storageKey) || { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', solves: {}, cursor: null, complete: false };
  if (!memory.has(storageKey)) { memory.set(storageKey, value); try { if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* memory fallback */ } }
  return value;
}

export function writeOfficialStreaks(owner: string, csesUserId: string, value: SavedStreaks): void {
  const storageKey = key(owner, csesUserId);
  memory.set(storageKey, value);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* memory fallback */ }
  if (typeof window !== 'undefined' && !changeEventQueued) {
    changeEventQueued = true;
    queueMicrotask(() => { changeEventQueued = false; window.dispatchEvent(new Event('cses-streaks-changed')); });
  }
}
let changeEventQueued = false;

export function listOfficialStreaks(owner: string): Record<string, string> {
  const prefix = `cses_official_streak_${owner}_`, result: Record<string, string> = {};
  const keys = new Set(memory.keys());
  try { if (typeof localStorage !== 'undefined') for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(prefix)) keys.add(k); } } catch { /* Memory fallback. */ }
  for (const storageKey of keys) if (storageKey.startsWith(prefix)) {
    const id = storageKey.slice(prefix.length);
    try { const value = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null; result[id] = value || JSON.stringify(memory.get(storageKey)); } catch { result[id] = JSON.stringify(memory.get(storageKey)); }
  }
  return result;
}

export function mergeImportedOfficialStreaks(owner: string, csesUserId: string, imported: Record<string, any>): void {
  const storageKey = key(owner, csesUserId);
  let hadState = memory.has(storageKey);
  try { hadState ||= typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) !== null; } catch { /* Memory-only environment. */ }
  const current = readOfficialStreaks(owner, csesUserId);
  const solves = { ...current.solves };
  if (imported.solves && typeof imported.solves === 'object' && !Array.isArray(imported.solves)) {
    for (const [id, date] of Object.entries(imported.solves)) {
      if (!id || typeof date !== 'string') continue;
      const time = Date.parse(date);
      if (!Number.isFinite(time) || time > Date.now()) continue;
      if (!solves[id] || time < Date.parse(solves[id])) solves[id] = new Date(time).toISOString();
    }
  }
  let timezone = current.timezone;
  if (!hadState) try { if (typeof imported.timezone === 'string') { new Intl.DateTimeFormat('en', { timeZone: imported.timezone }); timezone = imported.timezone; } } catch { /* Keep default zone. */ }
  writeOfficialStreaks(owner, csesUserId, { ...imported, ...current, timezone, solves });
}

export function clearOfficialStreakStorage(): void {
  memory.clear();
  try { if (typeof localStorage !== 'undefined') for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('cses_official_streak_')) localStorage.removeItem(k); } } catch { /* Best effort in restricted storage. */ }
}
