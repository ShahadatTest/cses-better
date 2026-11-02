import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  LanguageId,
  SubmissionRecord,
  UserDataExport,
  UserProfile,
} from './types';

const DRAFT_PREFIX = 'cses_draft_';
const NOTE_PREFIX = 'cses_notes_';
const SUBMISSIONS_KEY = 'cses_submissions';
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
  return getItem(`${NOTE_PREFIX}${problemId}`);
}

/**
 * Saves or clears markdown notes for a specific problem.
 */
export function saveNote(problemId: string, content: string): void {
  const key = `${NOTE_PREFIX}${problemId}`;
  if (!content || content.trim() === '') {
    removeItem(key);
  } else {
    setItem(key, content);
  }
}

/**
 * Retrieves all notes across all problems as a map: { [problemId]: content }
 */
export function getAllNotes(): Record<string, string> {
  const keys = getAllKeys();
  const notes: Record<string, string> = {};
  for (const k of keys) {
    if (k.startsWith(NOTE_PREFIX)) {
      const pId = k.slice(NOTE_PREFIX.length);
      const val = getItem(k);
      if (val !== null && val.trim() !== '') {
        notes[pId] = val;
      }
    }
  }
  return notes;
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
 * Returns a Set of problem IDs that have at least one Accepted ('AC') submission.
 */
export function getSolvedProblems(): Set<string> {
  const submissions = getSubmissions();
  const solved = new Set<string>();

  for (const sub of submissions) {
    if (sub.status === 'AC') {
      solved.add(sub.problemId);
    }
  }

  return solved;
}

/**
 * Records an official AC solve into submissions storage.
 */
export function saveSolvedProblem(
  problemId: string,
  language: LanguageId = 'cpp',
  code: string = ''
): void {
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
    if (k.startsWith(DRAFT_PREFIX) || k.startsWith(NOTE_PREFIX) || k === SUBMISSIONS_KEY || k === SETTINGS_KEY) {
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

