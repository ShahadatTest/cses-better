import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  LanguageId,
  NoteEntry,
  SubmissionRecord,
  UserDataExport,
  UserProfile,
} from './types';

const DRAFT_PREFIX = 'cses_draft_';
const NOTE_PREFIX = 'cses_notes_';
const SUBMISSIONS_KEY = 'cses_submissions';
const SOLVED_PROBLEMS_KEY = 'cses_solved_problem_ids';
export const STARRED_PROBLEMS_KEY = 'cses_starred_problem_ids';
const SETTINGS_KEY = 'cses_settings';
const USER_PROFILE_KEY = 'cses_user_profile';

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
  if (isLocalStorageAvailable()) {
    try {
      return window.localStorage.getItem(key);
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
      return keys;
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

  return solved;
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
}

/**
 * Returns a Set of problem IDs that have been starred/bookmarked by the user.
 */
export function getStarredProblems(): Set<string> {
  const starred = new Set<string>();
  const raw = getItem(STARRED_PROBLEMS_KEY);
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const id of arr) {
          if (typeof id === 'string' && id) starred.add(id);
        }
      }
    } catch {}
  }
  return starred;
}

/**
 * Persists an array or set of starred problem IDs directly.
 */
export function persistStarredProblems(starredIds: Set<string> | string[]): void {
  const arr = Array.from(starredIds);
  setItem(STARRED_PROBLEMS_KEY, JSON.stringify(arr));
}

/**
 * Saves a problem ID as starred/bookmarked.
 */
export function saveStarredProblem(id: string): void {
  if (!id) return;
  const current = getStarredProblems();
  current.add(id);
  persistStarredProblems(current);
}

/**
 * Removes a problem ID from starred/bookmarked.
 */
export function removeStarredProblem(id: string): void {
  if (!id) return;
  const current = getStarredProblems();
  current.delete(id);
  persistStarredProblems(current);
}

/**
 * Toggles the starred/bookmarked status for a problem ID.
 * Returns true if the problem is now starred, or false if unstarred.
 */
export function toggleStarredProblem(id: string): boolean {
  if (!id) return false;
  const current = getStarredProblems();
  if (current.has(id)) {
    current.delete(id);
    persistStarredProblems(current);
    return false;
  } else {
    current.add(id);
    persistStarredProblems(current);
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

  for (const k of keys) {
    if (k.startsWith(DRAFT_PREFIX)) {
      const draftKey = k.slice(DRAFT_PREFIX.length);
      const val = getItem(k);
      if (val !== null) {
        drafts[draftKey] = val;
      }
    }
  }

  const exportPayload: UserDataExport = {
    version: 1,
    drafts,
    submissions: getSubmissions(),
    notes: getAllNotes(),
    starredIds: Array.from(getStarredProblems()),
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
    const data: Partial<UserDataExport> = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      return false;
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

    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to clear all storage state (useful for test resets).
 */
export function clearAllStorage(): void {
  const keys = getAllKeys();
  for (const k of keys) {
    if (
      k.startsWith(DRAFT_PREFIX) ||
      k.startsWith(NOTE_PREFIX) ||
      k.startsWith('cses_note_') ||
      k.startsWith('cses_notemeta_') ||
      k === SUBMISSIONS_KEY ||
      k === SETTINGS_KEY ||
      k === SOLVED_PROBLEMS_KEY ||
      k === STARRED_PROBLEMS_KEY ||
      k === USER_PROFILE_KEY
    ) {
      removeItem(k);
    }
  }
  memoryStorage.clear();
}

/**
 * Retrieves persisted app settings, or defaults if not configured.
 */
export function getSettings(): AppSettings {
  const raw = getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_APP_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      widgetKey: parsed.widgetKey || DEFAULT_APP_SETTINGS.widgetKey,
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

/**
 * Persists app settings.
 */
export function saveSettings(settings: AppSettings): void {
  setItem(SETTINGS_KEY, JSON.stringify(settings));
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

