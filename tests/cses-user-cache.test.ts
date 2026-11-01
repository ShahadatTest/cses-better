import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerUserMapping,
  resolveUserNickToId,
  resolveUserIdToNick,
  getCuratedTopUsers,
} from '@/core/cses-user-cache';

describe('cses-user-cache', () => {
  it('resolves initial seeded high-profile CSES users', () => {
    expect(resolveUserNickToId('rainboy')).toBe('3628');
    expect(resolveUserNickToId('mitcute')).toBe('134297');
    expect(resolveUserNickToId('csesbetter99')).toBe('520654');
    expect(resolveUserNickToId('tourist')).toBe('1016');
  });

  it('handles case-insensitive lookups', () => {
    expect(resolveUserNickToId('RainBoy')).toBe('3628');
    expect(resolveUserNickToId('MITCUTE')).toBe('134297');
    expect(resolveUserNickToId('ToUrIsT')).toBe('1016');
  });

  it('passes through pure numeric user IDs unchanged', () => {
    expect(resolveUserNickToId('134297')).toBe('134297');
    expect(resolveUserNickToId('520654')).toBe('520654');
    expect(resolveUserNickToId('9999999')).toBe('9999999');
  });

  it('dynamically registers and resolves new user mappings bidirectionally', () => {
    registerUserMapping('AliceDev', '888888');

    expect(resolveUserNickToId('alicedev')).toBe('888888');
    expect(resolveUserNickToId('AliceDev')).toBe('888888');
    expect(resolveUserIdToNick('888888')).toBe('AliceDev');
  });

  it('ignores invalid inputs for registration', () => {
    registerUserMapping('', '12345');
    registerUserMapping('Bob', 'not-a-number');

    expect(resolveUserNickToId('Bob')).toBeUndefined();
  });

  it('returns curated top users for UI suggestions', () => {
    const curated = getCuratedTopUsers();
    expect(curated.length).toBeGreaterThan(0);
    expect(curated.some((u) => u.nick === 'rainboy')).toBe(true);
    expect(curated.some((u) => u.userId === '3628')).toBe(true);
  });
});
