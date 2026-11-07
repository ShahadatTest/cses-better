import { afterEach, expect, it, vi } from 'vitest';
import { setSupabaseInstance, syncUserDataToCloud, resetSyncCooldown } from '../src/core/supabase';

afterEach(() => { setSupabaseInstance(null); resetSyncCooldown(); });

for (const failingTable of ['profiles', 'user_solved', 'user_drafts', 'user_notes', 'user_submissions']) {
  it(`reports returned ${failingTable} errors and allows retry`, async () => {
    let fail = true;
    const from = vi.fn((table: string) => ({
      upsert: vi.fn(async () => ({ error: fail && table === failingTable ? new Error('offline') : null })),
    }));
    setSupabaseInstance({ from } as any);
    const data = {
      solvedIds: ['1068'], drafts: { '1068_cpp': 'code' }, notes: { '1068': 'note' },
      submissions: [{ id: 'one', problemId: '1068', language: 'cpp', status: 'AC', code: 'code', timestamp: Date.now() }] as any,
    };
    expect(await syncUserDataToCloud('owner', data, true)).toBe(false);
    fail = false;
    expect(await syncUserDataToCloud('owner', data, true)).toBe(true);
  });
}
