import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStreakState, recordOfficialSolve, saveStreakBackfill, getStreakBackfill, setStreakTimezone, syncOfficialSolves } from '../src/core/streaks';
import { importUserData, saveStarredProblem, removeStarredProblem, getPendingStarredChanges, getStarredProblems, clearAllStorage, saveStoredUser } from '../src/core/storage';
import { syncPendingStarredToCloud, setSupabaseInstance } from '../src/core/supabase';

describe('official CSES streaks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-10T12:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); setSupabaseInstance(null); });

  it('keeps earliest accepted time per problem and computes calendar days across DST', () => {
    const owner = `test-${Math.random()}`, csesUser = 'cses-1';
    setStreakTimezone(owner, csesUser, 'America/New_York');
    recordOfficialSolve(owner, csesUser, '1', '2025-03-09T05:30:00Z');
    recordOfficialSolve(owner, csesUser, '1', '2025-03-10T04:30:00Z');
    recordOfficialSolve(owner, csesUser, '2', '2025-03-10T10:00:00Z');
    recordOfficialSolve(owner, csesUser, 'future', '2025-03-11T00:00:00Z');

    const state = getStreakState(owner, csesUser);
    expect(state.firstAccepted['1']).toBe('2025-03-09T05:30:00.000Z');
    expect(state.firstAccepted.future).toBeUndefined();
    expect(state.current).toBe(2);
    expect(state.longest).toBe(2);
  });

  it('isolates CSES users and persists history resume cursor by owner', () => {
    const owner = `test-${Math.random()}`;
    recordOfficialSolve(owner, 'cses-a', '1', '2025-03-10T08:00:00Z');
    saveStreakBackfill(owner, 'cses-a', 'cursor-2', false);
    expect(getStreakState(owner, 'cses-b').firstAccepted).toEqual({});
    expect(getStreakState(`${owner}-other`, 'cses-a').firstAccepted).toEqual({});
    expect(getStreakBackfill(owner, 'cses-a')).toEqual({ cursor: 'cursor-2', complete: false });
  });

  it('persists completed scans that have timestamp gaps without claiming full coverage', () => {
    const owner = `test-${Math.random()}`;
    saveStreakBackfill(owner, 'cses-a', null, false, 'some accepted pages had no timestamp', { processed: 14, total: 20 }, { finished: true, hasGaps: true });
    expect(getStreakBackfill(owner, 'cses-a')).toEqual({ cursor: null, complete: false, finished: true, hasGaps: true, processed: 14, total: 20, incompleteReason: 'some accepted pages had no timestamp' });
  });

  it('deduplicates multiple solves on one day and grants yesterday grace only until today ends', () => {
    const owner = `test-${Math.random()}`, csesUser = 'cses-one';
    recordOfficialSolve(owner, csesUser, '1', '2025-03-10T08:00:00Z');
    recordOfficialSolve(owner, csesUser, '2', '2025-03-10T09:00:00Z');
    expect(getStreakState(owner, csesUser).longest).toBe(1);
    vi.setSystemTime(new Date('2025-03-11T12:00:00Z'));
    expect(getStreakState(owner, csesUser).current).toBe(1);
    vi.setSystemTime(new Date('2025-03-12T12:00:00Z'));
    expect(getStreakState(owner, csesUser).current).toBe(0);
  });

  it('rejects malformed imported timezone and accepted timestamps', () => {
    const csesUser = `cses-${Math.random().toString(36).slice(2)}`;
    importUserData(JSON.stringify({ officialStreaks: { [csesUser]: JSON.stringify({ timezone: 'Not/AZone', solves: { '1': 'not a date', '2': '2999-01-01T00:00:00Z' } }) } }));
    const state = getStreakState('guest', csesUser);
    expect(state.firstAccepted).toEqual({});
    expect(state.timezone).not.toBe('Not/AZone');
  });

  it('merges imported streak history without losing earlier dates or local backfill progress', () => {
    const owner = `test-${Math.random()}`, csesUser = `cses-${Math.random().toString(36).slice(2)}`;
    setStreakTimezone(owner, csesUser, 'UTC');
    recordOfficialSolve(owner, csesUser, 'same', '2025-03-10T08:00:00Z');
    recordOfficialSolve(owner, csesUser, 'local-only', '2025-03-09T08:00:00Z');
    saveStreakBackfill(owner, csesUser, 'newer-cursor', false);
    saveStoredUser({ id: owner } as never);
    const backup = { officialStreaks: { [csesUser]: JSON.stringify({ timezone: 'America/New_York', solves: { same: '2025-03-10T09:00:00Z', 'backup-only': '2025-03-08T08:00:00Z' }, cursor: 'old-cursor', complete: false }) } };
    expect(importUserData(JSON.stringify(backup))).toBe(true);
    expect(getStreakState(owner, csesUser).firstAccepted).toEqual({ same: '2025-03-10T08:00:00.000Z', 'local-only': '2025-03-09T08:00:00.000Z', 'backup-only': '2025-03-08T08:00:00.000Z' });
    expect(getStreakState(owner, csesUser).timezone).toBe('UTC');
    expect(getStreakBackfill(owner, csesUser).cursor).toBe('newer-cursor');
    saveStoredUser(null);
  });

  it('clears official streak backup data with all local storage', () => {
    const csesUser = `cses-${Math.random().toString(36).slice(2)}`;
    recordOfficialSolve('guest', csesUser, '1', '2025-03-10T08:00:00Z');
    clearAllStorage();
    expect(getStreakState('guest', csesUser).firstAccepted).toEqual({});
  });

  it('keeps guest, app-user, and CSES-user solve histories separate', () => {
    recordOfficialSolve('guest', 'cses-one', '1', '2025-03-10T08:00:00Z');
    recordOfficialSolve('app-user', 'cses-one', '2', '2025-03-10T08:00:00Z');
    recordOfficialSolve('app-user', 'cses-two', '3', '2025-03-10T08:00:00Z');
    expect(getStreakState('app-user', 'cses-one').firstAccepted).toEqual({ '2': '2025-03-10T08:00:00.000Z' });
    expect(getStreakState('app-user', 'cses-two').firstAccepted).toEqual({ '3': '2025-03-10T08:00:00.000Z' });
    expect(getStreakState('guest', 'cses-one').firstAccepted).toEqual({ '1': '2025-03-10T08:00:00.000Z' });
  });

  it('retains an unstar retry when Supabase reports a returned delete error', async () => {
    const owner = `test-${Math.random()}`;
    saveStarredProblem('1068', owner);
    removeStarredProblem('1068', owner);
    setSupabaseInstance({ auth: { getSession: async () => ({ data: { session: { user: { id: owner } } } }) }, from: () => ({
      delete: () => ({ eq: () => ({ eq: async () => ({ error: new Error('offline') }) }) }),
      select: () => ({ eq: async () => ({ data: [], error: null }) }),
    }) } as never);
    expect(await syncPendingStarredToCloud(owner)).toBe(false);
    expect(getPendingStarredChanges(owner)['1068'].starred).toBe(false);
  });

  it('serializes overlapping syncs so a late star write cannot beat a newer unstar', async () => {
    const owner = `test-${Math.random()}`, cloud = new Set<string>();
    let finishFirst!: (result: { error: null }) => void;
    let started!: () => void;
    const firstStarted = new Promise<void>(resolve => { started = resolve; });
    const firstWrite = new Promise<{ error: null }>(resolve => { finishFirst = resolve; });
    let delayFirst = true;
    setSupabaseInstance({
      auth: { getSession: async () => ({ data: { session: { user: { id: owner } } } }) },
      from: (table: string) => table === 'user_starred' ? {
        upsert: (row: { problem_id: string }) => {
          if (delayFirst) { delayFirst = false; started(); return firstWrite.then(result => { cloud.add(row.problem_id); return result; }); }
          cloud.add(row.problem_id); return Promise.resolve({ error: null });
        },
        delete: () => ({ eq: () => ({ eq: async (_column: string, id: string) => { cloud.delete(id); return { error: null }; } }) }),
        select: () => ({ eq: async () => ({ data: [...cloud].map(problem_id => ({ problem_id })), error: null }) }),
      } : { select: () => ({ eq: async () => ({ data: [], error: null }) }) },
    } as never);

    saveStarredProblem('1068', owner);
    const firstSync = syncPendingStarredToCloud(owner);
    await firstStarted;
    removeStarredProblem('1068', owner);
    const queuedSync = syncPendingStarredToCloud(owner);
    finishFirst({ error: null });
    await Promise.all([firstSync, queuedSync]);
    expect(cloud.has('1068')).toBe(false);
    expect(getStarredProblems(owner).has('1068')).toBe(false);
    expect(getPendingStarredChanges(owner)['1068']).toBeUndefined();
  });
});
