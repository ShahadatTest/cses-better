import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllStorage, getProblemLists, saveProblemLists, exportUserData, importUserData, importGuestLists, validateProblemLists } from '../src/core/storage';
import { setSupabaseInstance } from '../src/core/supabase';
import { syncProblemLists } from '../src/core/list-sync';
import { zcoRoadmap } from '../src/data/roadmaps';
import problems from '../src/data/problems.json';

const list = { id: '00000000-0000-4000-8000-000000000001', name: 'Practice', problemIds: ['1068'], revision: 1, dirty: true, deleted: false };
function client(rows: any[], onWrite?: (payload: any) => void) {
  return { auth: { getSession: async () => ({ data: { session: { user: { id: 'owner' } } } }) }, from: () => ({
    select: () => ({ eq: async () => ({ data: rows, error: null }) }),
    insert: (payload: any) => ({ select: () => ({ single: async () => { onWrite?.(payload); return { data: { revision: payload.revision }, error: null }; } }) }),
    update: (payload: any) => { const query: any = { eq: () => query, select: () => ({ single: async () => { onWrite?.(payload); return { data: { revision: payload.revision }, error: null }; } }) }; return query; },
  }) } as any;
}
const row = (revision: number, name = 'Practice') => ({ id: list.id, name, problem_ids: ['1068'], revision, deleted: false });
describe('problem lists', () => {
  beforeEach(() => clearAllStorage());
  afterEach(() => setSupabaseInstance(null));
  it('keeps account lists separate and backs up custom lists', () => {
    saveProblemLists([list]); saveProblemLists([{ ...list, name: 'Account' }], 'owner');
    expect(getProblemLists()[0].name).toBe('Practice'); expect(getProblemLists('owner')[0].name).toBe('Account');
    const backup = exportUserData(); clearAllStorage(); expect(importUserData(backup)).toBe(true); expect(getProblemLists()[0].name).toBe('Practice');
  });
  it('contains only catalog problems in the roadmap', () => {
    const ids = zcoRoadmap.sections.flatMap(section => section.problemIds);
    const catalog = new Set(problems.map(p => p.id)); expect(ids).toHaveLength(80); expect(new Set(ids).size).toBe(80); expect(ids.every(id => catalog.has(id))).toBe(true);
  });
  it('recognizes a lost acknowledgement without recovering a duplicate', async () => {
    saveProblemLists([list], 'owner'); let writes = 0; setSupabaseInstance(client([row(2)], () => writes++));
    expect(await syncProblemLists('owner')).toBe(true); expect(writes).toBe(0); expect(getProblemLists('owner')).toEqual([{ ...list, revision: 2, dirty: false }]);
  });
  it('preserves concurrent changes as a recovered copy', async () => {
    saveProblemLists([{ ...list, name: 'Local' }], 'owner'); setSupabaseInstance(client([row(2, 'Remote')]));
    expect(await syncProblemLists('owner')).toBe(true); const result = getProblemLists('owner');
    expect(result.map(l => l.name).sort()).toEqual(['Local (recovered)', 'Remote']); expect(result.every(l => !l.dirty)).toBe(true);
  });
  it('keeps an edit made while a write is in flight dirty with the new revision', async () => {
    saveProblemLists([list], 'owner'); setSupabaseInstance(client([row(1)], () => saveProblemLists([{ ...list, name: 'Edited later' }], 'owner')));
    expect(await syncProblemLists('owner')).toBe(false); expect(getProblemLists('owner')[0]).toMatchObject({ name: 'Edited later', revision: 2, dirty: true });
  });
});
  it('keeps a conflicting deletion as a tombstone and recovers the remote edit', async () => {
    saveProblemLists([{ ...list, deleted: true }], 'owner'); setSupabaseInstance(client([row(2, 'Remote edit')]));
    expect(await syncProblemLists('owner')).toBe(true); const result = getProblemLists('owner');
    expect(result.find(l => l.id === list.id)).toMatchObject({ deleted: true, revision: 3 });
    expect(result.find(l => l.id !== list.id)).toMatchObject({ name: 'Remote edit (recovered)', deleted: false });
  });
  it('preserves a dirty local edit when the server has a tombstone', async () => {
    saveProblemLists([list], 'owner'); setSupabaseInstance(client([{ ...row(2), deleted: true }]));
    expect(await syncProblemLists('owner')).toBe(true); const result = getProblemLists('owner');
    expect(result.find(l => l.id === list.id)?.deleted).toBe(true); expect(result.find(l => l.id !== list.id)).toMatchObject({ name: 'Practice (recovered)', deleted: false });
  });
  it('leaves failed writes dirty for a retry', async () => {
    saveProblemLists([list], 'owner'); const broken = client([row(1)]); broken.from = () => ({ select: () => ({ eq: async () => ({ data: [row(1)], error: null }) }), update: () => { const q: any = { eq: () => q, select: () => ({ single: async () => ({ data: null, error: {} }) }) }; return q; } }); setSupabaseInstance(broken);
    expect(await syncProblemLists('owner')).toBe(false); expect(getProblemLists('owner')[0].dirty).toBe(true);
    setSupabaseInstance(client([row(1)])); expect(await syncProblemLists('owner')).toBe(true); expect(getProblemLists('owner')[0].dirty).toBe(false);
  });

  it('imports guest lists once and rejects malformed backup lists without changing existing data', () => {
    saveProblemLists([list]); importGuestLists('owner'); importGuestLists('owner');
    expect(getProblemLists()).toEqual([]); expect(getProblemLists('owner')).toHaveLength(1);
    expect(importUserData(JSON.stringify({ lists: [{ id: 'x', name: 'bad', problemIds: ['invalid'] }] }))).toBe(false);
    expect(getProblemLists('owner')).toHaveLength(1);
  });
  it('accepts stable external contest task IDs in reusable lists', () => {
    expect(validateProblemLists([{ ...list, problemIds: ['usaco-2024-december-bronze-1', 'zio-2025-p1'] }])[0].problemIds).toEqual(['usaco-2024-december-bronze-1', 'zio-2025-p1']);
    expect(() => validateProblemLists([{ ...list, problemIds: ['other-2024-task'] }])).toThrow('Invalid problem list');
  });
  it('refreshes sync storage without emitting local-change events', () => {
    const dispatchEvent = vi.fn(); vi.stubGlobal('window', { dispatchEvent });
    try { saveProblemLists([list], 'owner', false); expect(dispatchEvent).not.toHaveBeenCalled(); }
    finally { vi.unstubAllGlobals(); }
  });
