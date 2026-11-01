/**
 * CSES User ID and Nickname Resolution Cache
 * CSES exposes profile endpoints primarily by numeric user ID (e.g. /user/134297 or /problemset/user/134297).
 * This module maintains bidirectional in-memory caches and automatic discovery from stats and auth.
 */

import { csesRequest, CSES_BASE_URL } from './cses-network';

const nickToIdMap = new Map<string, string>();
const idToNickMap = new Map<string, string>();

// Seed with well-known top CSES problem solvers & bot account
const INITIAL_SEEDS: [string, string][] = [
  ['csesbetter99', '520654'],
  ['rainboy', '3628'],
  ['LuCpp', '51394'],
  ['SanguineChame', '54997'],
  ['cepxuo', '8687'],
  ['Hando', '149144'],
  ['Lazar', '62360'],
  ['LoganGD', '124360'],
  ['ronr', '9299'],
  ['vidal.abner', '157346'],
  ['qusol', '199256'],
  ['mitcute', '134297'],
  ['tourist', '1016'],
  ['benq', '3590'],
  ['radewoosh', '574'],
  ['ecnerwala', '442'],
];

for (const [nick, id] of INITIAL_SEEDS) {
  nickToIdMap.set(nick.toLowerCase(), id);
  idToNickMap.set(id, nick);
}

/**
 * Register a mapping between a CSES handle and numeric user ID
 */
export function registerUserMapping(nick: string, userId: string): void {
  if (!nick || !userId) return;
  const cleanNick = nick.trim();
  const cleanId = userId.trim();
  if (!/^\d+$/.test(cleanId)) return;

  nickToIdMap.set(cleanNick.toLowerCase(), cleanId);
  idToNickMap.set(cleanId, cleanNick);
}

/**
 * Resolves an input (either numeric user ID or nickname) to a numeric user ID
 */
export function resolveUserNickToId(input: string): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  return nickToIdMap.get(trimmed.toLowerCase());
}

/**
 * Resolves a numeric user ID to a known nickname (if recorded)
 */
export function resolveUserIdToNick(userId: string): string | undefined {
  if (!userId) return undefined;
  return idToNickMap.get(userId.trim());
}

/**
 * Returns a list of curated top users for quick UI exploration
 */
export function getCuratedTopUsers(): { nick: string; userId: string }[] {
  return [
    { nick: 'rainboy', userId: '3628' },
    { nick: 'LuCpp', userId: '51394' },
    { nick: 'mitcute', userId: '134297' },
    { nick: 'csesbetter99', userId: '520654' },
    { nick: 'tourist', userId: '1016' },
    { nick: 'benq', userId: '3590' },
  ];
}

/**
 * On-demand scraper to ingest top solvers from CSES global stats page
 */
export async function ingestTopUsersFromCses(sessionCookie?: string): Promise<number> {
  try {
    const res = await csesRequest(`${CSES_BASE_URL}/problemset/stats/`, {
      cookie: sessionCookie,
    });
    if (res.statusCode !== 200) return 0;

    const regex = /<a href="\/problemset\/user\/(\d+)\/?">([^<]+)<\/a>/g;
    let count = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(res.body)) !== null) {
      const userId = match[1];
      const nick = match[2].trim();
      registerUserMapping(nick, userId);
      count++;
    }

    return count;
  } catch (err) {
    console.warn('[CSES User Cache] Failed to ingest top users from stats:', err);
    return 0;
  }
}
