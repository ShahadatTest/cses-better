import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  LanguageId,
  NoteEntry,
  SubmissionRecord,
  UserDataExport,
  UserProfile,
  ProblemList,
} from './types';
import { clearOfficialStreakStorage, listOfficialStreaks, mergeImportedOfficialStreaks } from './official-streak-storage';
import { COMMAND_CATALOG, validateShortcut, type CommandId } from './commands';

const DRAFT_PREFIX = 'cses_draft_';
const NOTE_PREFIX = 'cses_notes_';
const SUBMISSIONS_KEY = 'cses_submissions';
const SOLVED_PROBLEMS_KEY = 'cses_solved_problem_ids';
const UNSOLVED_PROBLEMS_KEY = 'cses_unsolved_problem_ids';
export const STARRED_PROBLEMS_KEY = 'cses_starred_problem_ids';
const STARRED_PREFIX = 'cses_starred_problem_ids_';
const STARRED_PENDING_PREFIX = 'cses_starred_pending_';
const STARRED_GUEST_MIGRATED = 'cses_starred_guest_migrated';
const STARRED_GUEST_CLAIMED = 'cses_starred_guest_claimed';
const SETTINGS_KEY = 'cses_settings';
const USER_PROFILE_KEY = 'cses_user_profile';
const LISTS_PREFIX = 'cses_lists_';

export function getProblemLists(owner = 'guest'): ProblemList[] {
  try {
    const value = JSON.parse(getItem(LISTS_PREFIX + owner) || '[]');
    return validateProblemLists(value);
  } catch { return []; }
}

export function validateProblemLists(value: unknown): ProblemList[] {
  if (!Array.isArray(value)) throw new Error('Lists must be an array');
  return value.map((list) => {
    if (!list || typeof list.id !== 'string' || !list.id ||
      typeof list.name !== 'string' || !list.name.trim() || list.name.length > 120 ||
      !Array.isArray(list.problemIds) || list.problemIds.some((id: unknown) => typeof id !== 'string' || !(/^(?:\d+|(?:zio|zco|inoi|usaco)-\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(id)))) {
      throw new Error('Invalid problem list');
    }
    return { id: list.id, name: list.name.trim(), problemIds: [...new Set<string>(list.problemIds)],
      revision: Number.isSafeInteger(list.revision) && list.revision >= 0 ? list.revision : 0,
      dirty: list.dirty === true, deleted: list.deleted === true };
  });
}

export function saveProblemLists(lists: ProblemList[], owner = 'guest', notify = true): void {
  const value = JSON.stringify(validateProblemLists(lists));
  if (getItem(LISTS_PREFIX + owner) === value) return;
  setItem(LISTS_PREFIX + owner, value);
  if (notify && typeof window !== 'undefined') window.dispatchEvent(new Event('cses-lists-changed'));
}

export function importGuestLists(owner: string): void {
  const guests = getProblemLists();
  if (!guests.length) return;
  const current = getProblemLists(owner);
  saveProblemLists([...current, ...guests.filter(g => !current.some(l => l.id === g.id))], owner);
  // Keep the source if browser persistence failed; memory fallback cannot survive a reload.
  try {
    if (typeof window === 'undefined' || (isLocalStorageAvailable() && window.localStorage.getItem(LISTS_PREFIX + owner) === JSON.stringify(getProblemLists(owner)))) removeItem(LISTS_PREFIX + 'guest');
  } catch { /* Keep guest lists when storage is unavailable. */ }
}

// In-memory fallback for SSR and non-browser test environments
const memoryStorage = new Map<string, string>();

function isLocalStorageAvailable(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined' &&
      window.localStorage !== null
    );
  } catch {
    return false;
  }
}

function getItem(key: string): string | null {
  if (memoryStorage.has(key)) return memoryStorage.get(key)!;
  if (isLocalStorageAvailable()) {
    try {
      return window.localStorage.getItem(key) ?? memoryStorage.get(key) ?? null;
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  }
  return memoryStorage.get(key) ?? null;
}

function setItem(key: string, value: string): void {
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(key, value);
      memoryStorage.delete(key);
      return;
    } catch {
      // Fallback to memoryStorage on quota exceeded or permission denied
    }
  }
  memoryStorage.set(key, value);
}

function removeItem(key: string): void {
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignored
    }
  }
  memoryStorage.delete(key);
}

function getAllKeys(): string[] {
  if (isLocalStorageAvailable()) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k) keys.push(k);
      }
      return Array.from(new Set([...keys, ...memoryStorage.keys()]));
    } catch {
      return Array.from(memoryStorage.keys());
    }
  }
  return Array.from(memoryStorage.keys());
}

/**
 * Returns saved draft code for a problem and language.
 */
export function getDraft(problemId: string, language: LanguageId): string | null {
  const key = `${DRAFT_PREFIX}${problemId}_${language}`;
  return getItem(key);
}

/**
 * Saves draft code for a problem and language.
 */
export function saveDraft(
  problemId: string,
  language: LanguageId,
  code: string
): void {
  const key = `${DRAFT_PREFIX}${problemId}_${language}`;
  if (code === '') {
    removeItem(key);
  } else {
    setItem(key, code);
  }
}

/**
 * Returns saved markdown notes for a specific problem.
 */
export function getNote(problemId: string): string | null {
  return getItem(`${NOTE_PREFIX}${problemId}`) ?? getItem(`cses_note_${problemId}`);
}

/**
 * Saves or clears markdown notes for a specific problem.
 */
export function saveNote(problemId: string, content: string, updatedAt?: number): void {
  const key = `${NOTE_PREFIX}${problemId}`;
  const metaKey = `cses_notemeta_${problemId}`;
  if (!content || content.trim() === '') {
    removeItem(key);
    removeItem(`cses_note_${problemId}`);
    removeItem(metaKey);
    removeItem(`cses_note_meta_${problemId}`);
  } else {
    setItem(key, content);
    setItem(metaKey, JSON.stringify({ updatedAt: updatedAt ?? Date.now() }));
  }
}

/**
 * Retrieves all notes across all problems as a map: { [problemId]: content }
 * Preserves backwards compatibility for existing tests and cloud sync.
 */
export function getAllNotes(): Record<string, string> {
  const keys = getAllKeys();
  const notes: Record<string, string> = {};
  for (const k of keys) {
    if (k.startsWith('cses_notemeta_') || k.startsWith('cses_note_meta_')) continue;
    let pId: string | null = null;
    if (k.startsWith(NOTE_PREFIX)) {
      pId = k.slice(NOTE_PREFIX.length);
    } else if (k.startsWith('cses_note_')) {
      pId = k.slice('cses_note_'.length);
    }
    if (pId && notes[pId] === undefined) {
      const val = getItem(k);
      if (val !== null && val.trim() !== '') {
        notes[pId] = val;
      }
    }
  }
  return notes;
}

/**
 * Retrieves all notes across all problems as a structured list of entries.
 */
export function getAllNotesList(): NoteEntry[] {
  const keys = getAllKeys();
  const seen = new Set<string>();
  const list: Array<{ problemId: string; content: string; updatedAt?: number }> = [];

  for (const k of keys) {
    if (k.startsWith('cses_notemeta_') || k.startsWith('cses_note_meta_')) continue;
    let pId: string | null = null;
    if (k.startsWith(NOTE_PREFIX)) {
      pId = k.slice(NOTE_PREFIX.length);
    } else if (k.startsWith('cses_note_')) {
      pId = k.slice('cses_note_'.length);
    }

    if (pId && !seen.has(pId)) {
      seen.add(pId);
      const val = getItem(k);
      if (val !== null && val.trim() !== '') {
        let updatedAt: number | undefined;
        const meta = getItem(`cses_notemeta_${pId}`) || getItem(`cses_note_meta_${pId}`);
        if (meta) {
          try {
            const parsed = JSON.parse(meta);
            if (typeof parsed.updatedAt === 'number') {
              updatedAt = parsed.updatedAt;
            }
          } catch {
            // ignore
          }
        }
        list.push({
          problemId: pId,
          content: val,
          updatedAt: updatedAt ?? Date.now(),
        });
      }
    }
  }

  list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return list;
}

/**
 * Retrieves submission history, optionally filtered by problemId.
 * Returns results sorted newest first (descending timestamp).
 */
export function getSubmissions(problemId?: string): SubmissionRecord[] {
  const raw = getItem(SUBMISSIONS_KEY);
  if (!raw) return [];

  try {
    const list: SubmissionRecord[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    const filtered = problemId
      ? list.filter((sub) => sub.problemId === problemId)
      : list;

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

/**
 * Saves a new submission record to history.
 */
export function saveSubmission(record: SubmissionRecord): void {
  const raw = getItem(SUBMISSIONS_KEY);
  let list: SubmissionRecord[] = [];

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed;
      }
    } catch {
      list = [];
    }
  }

  // Deduplicate by submission ID if exists
  const existingIdx = list.findIndex((s) => s.id === record.id);
  if (existingIdx >= 0) {
    list[existingIdx] = record;
  } else {
    list.unshift(record);
  }

  setItem(SUBMISSIONS_KEY, JSON.stringify(list));
}

/**
 * Returns a Set of problem IDs that have been marked as solved or have an Accepted ('AC') submission.
 */
export function getSolvedProblems(): Set<string> {
  const solved = new Set<string>();

  // 1. Read explicitly stored solved IDs
  const rawSolved = getItem(SOLVED_PROBLEMS_KEY);
  if (rawSolved) {
    try {
      const arr = JSON.parse(rawSolved);
      if (Array.isArray(arr)) {
        for (const id of arr) {
          if (typeof id === 'string' && id) solved.add(id);
        }
      }
    } catch {}
  }

  // 2. Read from submissions history
  const submissions = getSubmissions();
  for (const sub of submissions) {
    if (sub.status === 'AC') {
      solved.add(sub.problemId);
    }
  }

  for (const id of getExplicitlyUnsolved()) solved.delete(id);
  return solved;
}

function getExplicitlyUnsolved(): Set<string> {
  try { const value = JSON.parse(getItem(UNSOLVED_PROBLEMS_KEY) || '[]'); return new Set(Array.isArray(value) ? value.filter((id: unknown) => typeof id === 'string') : []); }
  catch { return new Set(); }
}

/**
 * Persists an array or set of solved problem IDs directly.
 */
export function persistSolvedProblems(solvedIds: Set<string> | string[]): void {
  const arr = Array.from(solvedIds);
  setItem(SOLVED_PROBLEMS_KEY, JSON.stringify(arr));
}

/**
 * Records an official AC solve into solved problems and optional submissions storage.
 */
export function saveSolvedProblem(
  problemId: string,
  language: LanguageId = 'cpp',
  code: string = ''
): void {
  const unsolved = getExplicitlyUnsolved();
  unsolved.delete(problemId);
  setItem(UNSOLVED_PROBLEMS_KEY, JSON.stringify([...unsolved]));
  // Add to solved IDs set
  const current = getSolvedProblems();
  current.add(problemId);
  persistSolvedProblems(current);

  // Only record submission if actual source code is present to avoid empty 0-character bench entries
  if (code && code.trim().length > 0) {
    saveSubmission({
      id: `cses-official-${problemId}-${Date.now()}`,
      problemId,
      language,
      code,
      charCount: code.length,
      timestamp: Date.now(),
      status: 'AC',
      passedCount: 1,
      totalCount: 1,
      maxTimeMs: 50,
      maxMemoryBytes: 1024 * 1024,
    });
  }
}

/**
 * Removes a problem from solved problems tracking.
 */
export function removeSolvedProblem(problemId: string): void {
  const current = getSolvedProblems();
  current.delete(problemId);
  persistSolvedProblems(current);
  const unsolved = getExplicitlyUnsolved();
  unsolved.add(problemId);
  setItem(UNSOLVED_PROBLEMS_KEY, JSON.stringify([...unsolved]));
}

/**
 * Returns a Set of problem IDs that have been starred/bookmarked by the user.
 */
function starOwner(owner?: string): string { return owner ?? getStoredUser()?.id ?? 'guest'; }

function migrateLegacyStars(): void {
  if (getItem(STARRED_GUEST_MIGRATED)) return;
  const raw = getItem(STARRED_PROBLEMS_KEY);
  if (raw) {
    try {
      const old = JSON.parse(raw);
      if (Array.isArray(old)) {
        const owner = getStoredUser()?.id ?? 'guest';
        const ids = [...new Set(old.filter((id): id is string => typeof id === 'string' && !!id))];
        setItem(STARRED_PREFIX + owner, JSON.stringify(ids));
        const pending = getPendingStarredChanges(owner);
        for (const id of ids) pending[id] = { starred: true, operation: `${Date.now()}-${Math.random()}` };
        setItem(STARRED_PENDING_PREFIX + owner, JSON.stringify(pending));
      }
    } catch { /* Ignore malformed legacy data. */ }
  }
  setItem(STARRED_GUEST_MIGRATED, '1');
  removeItem(STARRED_PROBLEMS_KEY);
}

function getStarredSnapshot(owner: string): Set<string> {
  try { const raw = JSON.parse(getItem(STARRED_PREFIX + owner) || '[]'); return new Set(Array.isArray(raw) ? raw.filter((id: unknown) => typeof id === 'string' && !!id) : []); }
  catch { return new Set(); }
}

export interface PendingStarChange { starred: boolean; operation: string }
export function getPendingStarredChanges(owner = starOwner()): Record<string, PendingStarChange> {
  try {
    const value = JSON.parse(getItem(STARRED_PENDING_PREFIX + owner) || '{}');
    return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, change]) => {
      if (!change || typeof change !== 'object') return false;
      const candidate = change as Partial<PendingStarChange>;
      return typeof candidate.starred === 'boolean' && typeof candidate.operation === 'string';
    })) as Record<string, PendingStarChange> : {};
  }
  catch { return {}; }
}
export function acknowledgeStarredChange(owner: string, id: string, operation: string): void {
  const pending = getPendingStarredChanges(owner);
  if (pending[id]?.operation === operation) { delete pending[id]; setItem(STARRED_PENDING_PREFIX + owner, JSON.stringify(pending)); }
}
export function overlayPendingStars(ids: string[], owner: string): Set<string> {
  const merged = new Set(ids);
  for (const [id, change] of Object.entries(getPendingStarredChanges(owner))) change.starred ? merged.add(id) : merged.delete(id);
  return merged;
}

export function getStarredProblems(owner = starOwner()): Set<string> {
  if (owner === 'guest' || owner === getStoredUser()?.id) migrateLegacyStars();
  return getStarredSnapshot(owner);
}

/** Persists a complete desired set and records each changed problem for cloud sync. */
export function persistStarredProblems(starredIds: Set<string> | string[], owner = starOwner()): void {
  const ids = new Set(starredIds);
  const before = getStarredSnapshot(owner);
  setItem(STARRED_PREFIX + owner, JSON.stringify([...ids]));
  const pending = getPendingStarredChanges(owner);
  for (const id of new Set([...before, ...ids])) {
    if (before.has(id) !== ids.has(id)) pending[id] = { starred: ids.has(id), operation: `${Date.now()}-${Math.random()}` };
  }
  setItem(STARRED_PENDING_PREFIX + owner, JSON.stringify(pending));
}

export function replaceStarredProblemsFromCloud(starredIds: Set<string> | string[], owner: string): void {
  setItem(STARRED_PREFIX + owner, JSON.stringify([...new Set(starredIds)]));
}

/** Transfers pre-auth guest stars to the first signed-in account once. */
export function claimGuestStars(owner: string): void {
  if (!owner || owner === 'guest' || getItem(STARRED_GUEST_CLAIMED)) return;
  const guest = getStarredProblems('guest');
  const account = getStarredProblems(owner);
  for (const id of guest) account.add(id);
  persistStarredProblems(account, owner);
  removeItem(STARRED_PREFIX + 'guest');
  removeItem(STARRED_PENDING_PREFIX + 'guest');
  setItem(STARRED_GUEST_CLAIMED, owner);
}

/**
 * Saves a problem ID as starred/bookmarked.
 */
export function saveStarredProblem(id: string, owner = starOwner()): void {
  if (!id) return;
  const current = getStarredProblems(owner);
  current.add(id);
  persistStarredProblems(current, owner);
}

/**
 * Removes a problem ID from starred/bookmarked.
 */
export function removeStarredProblem(id: string, owner = starOwner()): void {
  if (!id) return;
  const current = getStarredProblems(owner);
  current.delete(id);
  persistStarredProblems(current, owner);
}

/**
 * Toggles the starred/bookmarked status for a problem ID.
 * Returns true if the problem is now starred, or false if unstarred.
 */
export function toggleStarredProblem(id: string, owner = starOwner()): boolean {
  if (!id) return false;
  const current = getStarredProblems(owner);
  if (current.has(id)) {
    current.delete(id);
    persistStarredProblems(current, owner);
    return false;
  } else {
    current.add(id);
    persistStarredProblems(current, owner);
    return true;
  }
}

/**
 * Removes empty dummy submissions that have no code to keep submission bench clean.
 */
export function cleanEmptySubmissions(): void {
  const raw = getItem(SUBMISSIONS_KEY);
  if (!raw) return;
  try {
    const list: SubmissionRecord[] = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    const filtered = list.filter((sub) => {
      // Keep real submissions or submissions that contain code
      if (!sub.code || sub.code.trim().length === 0) {
        return false;
      }
      return true;
    });
    setItem(SUBMISSIONS_KEY, JSON.stringify(filtered));
  } catch {}
}

/**
 * Exports all user data (drafts, submissions) to a JSON string.
 */
export function exportUserData(): string {
  const keys = getAllKeys();
  const drafts: Record<string, string> = {};
  const owner = getStoredUser()?.id ?? 'guest';
  const officialStreaks: Record<string, string> = {};

  for (const k of keys) {
    if (k.startsWith(DRAFT_PREFIX)) {
      const draftKey = k.slice(DRAFT_PREFIX.length);
      const val = getItem(k);
      if (val !== null) {
        drafts[draftKey] = val;
      }
    }
  }

  Object.assign(officialStreaks, listOfficialStreaks(owner));

  const exportPayload: UserDataExport & { officialStreaks?: Record<string, string> } = {
    lists: getProblemLists(owner),
    version: 1,
    drafts,
    submissions: getSubmissions(),
    notes: getAllNotes(),
    starredIds: Array.from(getStarredProblems()),
    officialStreaks,
    exportedAt: Date.now(),
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Imports user data from an exported JSON string.
 * Returns true if successful, false otherwise.
 */
export function importUserData(jsonStr: string): boolean {
  try {
    const data: Partial<UserDataExport> & { officialStreaks?: Record<string, string> } = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      return false;
    }
    const lists = data.lists === undefined ? undefined : validateProblemLists(data.lists);
    if (lists) {
      const owner = getStoredUser()?.id;
      const current = getProblemLists(owner);
      // Backups create independent lists so importing never overwrites a newer device edit.
      saveProblemLists([...current, ...lists.filter(l => !l.deleted).map(l => ({ ...l, id: crypto.randomUUID(), revision: 0, dirty: true }))], owner);
    }

    // Restore drafts
    if (data.drafts && typeof data.drafts === 'object') {
      for (const [key, code] of Object.entries(data.drafts)) {
        if (typeof code === 'string') {
          setItem(`${DRAFT_PREFIX}${key}`, code);
        }
      }
    }

    // Restore notes
    if (data.notes && typeof data.notes === 'object') {
      for (const [pId, content] of Object.entries(data.notes)) {
        if (typeof content === 'string') {
          saveNote(pId, content);
        }
      }
    }

    // Restore submissions
    if (Array.isArray(data.submissions)) {
      const existing = getSubmissions();
      const existingIds = new Set(existing.map((s) => s.id));

      for (const sub of data.submissions) {
        if (sub && sub.id && !existingIds.has(sub.id)) {
          existing.push(sub);
          existingIds.add(sub.id);
        }
      }

      existing.sort((a, b) => b.timestamp - a.timestamp);
      setItem(SUBMISSIONS_KEY, JSON.stringify(existing));
    }

    // Restore starred problems
    if (Array.isArray(data.starredIds)) {
      const currentStarred = getStarredProblems();
      for (const id of data.starredIds) {
        if (typeof id === 'string' && id) {
          currentStarred.add(id);
        }
      }
      persistStarredProblems(currentStarred);
    }

    if (data.officialStreaks && typeof data.officialStreaks === 'object') {
      const owner = getStoredUser()?.id ?? 'guest';
      for (const [csesUserId, raw] of Object.entries(data.officialStreaks)) {
        if (typeof raw !== 'string' || !/^[a-zA-Z0-9_.-]{1,100}$/.test(csesUserId)) continue;
        const state = JSON.parse(raw);
        if (!state || typeof state !== 'object' || !state.solves || typeof state.solves !== 'object') continue;
        mergeImportedOfficialStreaks(owner, csesUserId, state);
      }
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('cses-streaks-changed'));
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to clear all storage state (useful for test resets).
 */
export function clearAllStorage(): void {
  clearOfficialStreakStorage();
  const keys = getAllKeys();
  for (const k of keys) {
    if (
      k.startsWith(DRAFT_PREFIX) ||
      k.startsWith(LISTS_PREFIX) ||
      k.startsWith(NOTE_PREFIX) ||
      k.startsWith('cses_note_') ||
      k.startsWith('cses_notemeta_') ||
      k === SUBMISSIONS_KEY ||
      k === SETTINGS_KEY ||
      k === SOLVED_PROBLEMS_KEY ||
      k === UNSOLVED_PROBLEMS_KEY ||
      k === STARRED_PROBLEMS_KEY ||
      k.startsWith(STARRED_PREFIX) || k.startsWith(STARRED_PENDING_PREFIX) || k === STARRED_GUEST_MIGRATED ||
      k === STARRED_GUEST_CLAIMED ||
      k.startsWith('cses_official_streak_') ||
      k === USER_PROFILE_KEY
    ) {
      removeItem(k);
    }
  }
  memoryStorage.clear();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cses-storage-cleared'));
}

/**
 * Retrieves persisted app settings, or defaults if not configured.
 */
export function getSettings(): AppSettings {
  const raw = getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_APP_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    const parsedSettings = parsed && typeof parsed === 'object' ? parsed : {};
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsedSettings,
      theme: ['dark', 'dim', 'light', 'system'].includes(parsedSettings.theme) ? parsedSettings.theme : DEFAULT_APP_SETTINGS.theme,
      accent: ['blue', 'teal', 'green', 'orange', 'pink'].includes(parsedSettings.accent) ? parsedSettings.accent : DEFAULT_APP_SETTINGS.accent,
      shortcutOverrides: validateShortcutOverrides(parsedSettings.shortcutOverrides),
      widgetKey: parsedSettings.widgetKey || DEFAULT_APP_SETTINGS.widgetKey,
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

/**
 * Persists app settings.
 */
export function saveSettings(settings: AppSettings): void {
  const current = getSettings();
  const next: AppSettings = {
    ...current,
    ...settings,
    theme: ['dark', 'dim', 'light', 'system'].includes(settings.theme) ? settings.theme : current.theme,
    accent: ['blue', 'teal', 'green', 'orange', 'pink'].includes(settings.accent) ? settings.accent : current.accent,
    shortcutOverrides: validateShortcutOverrides(settings.shortcutOverrides ?? current.shortcutOverrides),
  };
  setItem(SETTINGS_KEY, JSON.stringify(next));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cses-settings-changed'));
}

function validateShortcutOverrides(value: unknown): Record<string, string | null> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  const known = new Set<string>(COMMAND_CATALOG.map(command => command.id));
  const sanitized: Record<string, string | null> = {};
  for (const [key, binding] of entries) if (known.has(key) && binding === null) sanitized[key] = null;
  for (const [key, binding] of entries) {
    if (!known.has(key) || (binding !== null && typeof binding !== 'string')) continue;
    if (binding === null) continue;
    const validation = validateShortcut(binding, key as CommandId, sanitized);
    if (validation.valid && validation.normalized) sanitized[key] = validation.normalized;
  }
  return sanitized;
}

/**
 * Persists authenticated user profile for immediate UI hydration
 */
export function saveStoredUser(user: UserProfile | null): void {
  if (!user) {
    removeItem(USER_PROFILE_KEY);
    return;
  }
  setItem(USER_PROFILE_KEY, JSON.stringify(user));
}

/**
 * Retrieves persisted user profile
 */
export function getStoredUser(): UserProfile | null {
  const raw = getItem(USER_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

/**
 * Clears persisted user profile
 */
export function clearStoredUser(): void {
  removeItem(USER_PROFILE_KEY);
}

