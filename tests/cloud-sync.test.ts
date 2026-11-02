import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveNote,
  getNote,
  getAllNotes,
  clearAllStorage,
  exportUserData,
  importUserData,
} from '../src/core/storage';
import {
  mapSupabaseUser,
  setSupabaseInstance,
  saveUserNoteToCloud,
  syncUserDataToCloud,
  fetchUserDataFromCloud,
  saveUserStarredToCloud,
  syncAllLocalProgressToCloud,
  resetSyncCooldown,
  SYNC_COOLDOWN_MS,
} from '../src/core/supabase';

describe('Cloud Sync & Notes Storage Unit Tests', () => {
  beforeEach(() => {
    clearAllStorage();
  });

  it('stores and retrieves problem notes correctly', () => {
    expect(getNote('1068')).toBeNull();
    saveNote('1068', 'Approach: Use binary exponentiation and check bounds.');
    expect(getNote('1068')).toBe('Approach: Use binary exponentiation and check bounds.');

    // Updating note
    saveNote('1068', 'Updated approach.');
    expect(getNote('1068')).toBe('Updated approach.');

    // Clearing note
    saveNote('1068', '');
    expect(getNote('1068')).toBeNull();
  });

  it('collects all notes across problems with getAllNotes', () => {
    saveNote('1068', 'Note 1');
    saveNote('1083', 'Note 2');
    saveNote('1069', 'Note 3');

    const all = getAllNotes();
    expect(all['1068']).toBe('Note 1');
    expect(all['1083']).toBe('Note 2');
    expect(all['1069']).toBe('Note 3');
  });

  it('exports and imports notes seamlessly in UserDataExport', () => {
    saveNote('1068', 'Important mathematical proof');
    const exportedJson = exportUserData();
    const parsed = JSON.parse(exportedJson);
    expect(parsed.notes).toBeDefined();
    expect(parsed.notes['1068']).toBe('Important mathematical proof');

    clearAllStorage();
    expect(getNote('1068')).toBeNull();

    const ok = importUserData(exportedJson);
    expect(ok).toBe(true);
    expect(getNote('1068')).toBe('Important mathematical proof');
  });

  it('accurately maps GitHub OAuth user metadata to UserProfile', () => {
    const mockUser: any = {
      id: 'uuid-12345',
      email: 'pom@example.com',
      user_metadata: {
        user_name: 'codewithpom',
        full_name: 'Code With Pom',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      },
      app_metadata: {
        provider: 'github',
      },
      created_at: '2026-11-01T12:00:00Z',
    };

    const profile = mapSupabaseUser(mockUser);
    expect(profile.id).toBe('uuid-12345');
    expect(profile.username).toBe('codewithpom');
    expect(profile.displayName).toBe('codewithpom');
    expect(profile.avatarUrl).toBe('https://avatars.githubusercontent.com/u/12345');
    expect(profile.provider).toBe('github');
  });
});

describe('Supabase Authenticated Session Check & Cooldown Throttle', () => {
  beforeEach(() => {
    clearAllStorage();
    resetSyncCooldown();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setSupabaseInstance(null);
    resetSyncCooldown();
  });

  it('rejects unauthenticated queries without calling client.from', async () => {
    const mockFrom = vi.fn();
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });

    setSupabaseInstance({
      auth: { getSession: mockGetSession },
      from: mockFrom,
    } as any);

    const noteOk = await saveUserNoteToCloud('user-1', '1068', 'my note');
    expect(noteOk).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();

    const syncOk = await syncUserDataToCloud('user-1', { solvedIds: ['1068'] });
    expect(syncOk).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();

    const fetchRes = await fetchUserDataFromCloud('user-1');
    expect(fetchRes).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();

    const starOk = await saveUserStarredToCloud('user-1', '1068', true);
    expect(starOk).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects query when session user.id does not match target userId', async () => {
    const mockFrom = vi.fn();
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: 'attacker-id' } } },
      error: null,
    });

    setSupabaseInstance({
      auth: { getSession: mockGetSession },
      from: mockFrom,
    } as any);

    const noteOk = await saveUserNoteToCloud('victim-id', '1068', 'stolen note');
    expect(noteOk).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();

    const syncOk = await syncUserDataToCloud('victim-id', { solvedIds: ['1068'] });
    expect(syncOk).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('enforces 60-second cooldown on syncUserDataToCloud unless force is true', async () => {
    resetSyncCooldown();

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({
      upsert: mockUpsert,
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }),
    });
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });

    setSupabaseInstance({
      auth: { getSession: mockGetSession },
      from: mockFrom,
    } as any);

    // 1st call: succeeds and sets lastSyncTimestamp
    const firstSync = await syncUserDataToCloud('user-1', { solvedIds: ['1068'] });
    expect(firstSync).toBe(true);

    // 2nd call immediate: throttled under 60s cooldown
    const secondSync = await syncUserDataToCloud('user-1', { solvedIds: ['1068'] });
    expect(secondSync).toBe(false);

    // 3rd call with force = true: bypasses cooldown
    const forcedSync = await syncUserDataToCloud('user-1', { solvedIds: ['1068'] }, true);
    expect(forcedSync).toBe(true);
  });

  it('enforces cooldown on syncAllLocalProgressToCloud but respects force flag', async () => {
    resetSyncCooldown();

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({
      upsert: mockUpsert,
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }),
    });
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });

    setSupabaseInstance({
      auth: { getSession: mockGetSession },
      from: mockFrom,
    } as any);

    const res1 = await syncAllLocalProgressToCloud('user-1', true);
    expect(res1.success).toBe(true);

    // Second call without force should return early with local counts without calling upsert again
    mockUpsert.mockClear();
    const res2 = await syncAllLocalProgressToCloud('user-1', false);
    expect(res2.success).toBe(true);
    expect(mockUpsert).not.toHaveBeenCalled();

    // Forced call bypasses throttle and runs upsert
    const res3 = await syncAllLocalProgressToCloud('user-1', true);
    expect(res3.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalled();
  });
});
