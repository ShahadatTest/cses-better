import { getSupabase } from './supabase';
import { readOfficialStreaks, writeOfficialStreaks } from './official-streak-storage';

export interface OfficialSolve { problemId: string; acceptedAt: string }
export interface StreakState { current: number; longest: number; recentDays: string[]; timezone: string; firstAccepted: Record<string, string> }
const localDay = (date: Date, timezone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const addDays = (day: string, n: number) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + n); return date.toISOString().slice(0, 10); };
const read = readOfficialStreaks;
const write = writeOfficialStreaks;

export function recordOfficialSolve(owner: string, csesUserId: string, problemId: string, acceptedAt: string | number): void {
  if (!owner || !csesUserId || !problemId) return;
  const date = new Date(acceptedAt);
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) return;
  const value = read(owner, csesUserId), previous = value.solves[problemId];
  if (!previous || date.getTime() < Date.parse(previous)) value.solves[problemId] = date.toISOString();
  write(owner, csesUserId, value);
}

export function getStreakState(owner: string, csesUserId: string): StreakState {
  const value = read(owner, csesUserId), days = [...new Set(Object.values(value.solves).map(d => localDay(new Date(d), value.timezone)))].sort();
  const today = localDay(new Date(), value.timezone), yesterday = addDays(today, -1);
  let current = 0;
  if (days.includes(today) || days.includes(yesterday)) {
    let cursor = days.includes(today) ? today : yesterday;
    const set = new Set(days);
    while (set.has(cursor)) { current++; cursor = addDays(cursor, -1); }
  }
  let longest = 0, run = 0, prior = '';
  for (const day of days) { run = prior && addDays(day, -1) === prior ? run + 1 : 1; longest = Math.max(longest, run); prior = day; }
  return { current, longest, recentDays: days.slice(-35), timezone: value.timezone, firstAccepted: value.solves };
}

export function setStreakTimezone(owner: string, csesUserId: string, timezone: string): void {
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); const value = read(owner, csesUserId); value.timezone = timezone; write(owner, csesUserId, value); } catch { /* Reject invalid browser timezone values. */ }
}

export function getStreakBackfill(owner: string, csesUserId: string): { cursor: string | null; complete: boolean; finished?: boolean; hasGaps?: boolean; processed?: number; total?: number; incompleteReason?: string } {
  const { cursor, complete, finished, hasGaps, processed, total, incompleteReason } = read(owner, csesUserId);
  return { cursor, complete, ...(finished !== undefined ? { finished } : {}), ...(hasGaps !== undefined ? { hasGaps } : {}), ...(processed !== undefined ? { processed } : {}), ...(total !== undefined ? { total } : {}), ...(incompleteReason ? { incompleteReason } : {}) };
}
export function saveStreakBackfill(owner: string, csesUserId: string, cursor: string | null, complete: boolean, incompleteReason?: string, progress?: { processed: number; total: number }, status?: { finished: boolean; hasGaps: boolean }): void {
  const value = read(owner, csesUserId); value.cursor = cursor; value.complete = complete; value.incompleteReason = incompleteReason;
  if (status) { value.finished = status.finished; value.hasGaps = status.hasGaps; }
  if (progress) { value.processed = progress.processed; value.total = progress.total; }
  write(owner, csesUserId, value);
}

export async function syncOfficialSolves(owner: string, csesUserId: string): Promise<boolean> {
  if (owner === 'guest') return false;
  const client = getSupabase(); if (!client) return false;
  const { data: sessionData } = await client.auth.getSession();
  if (sessionData.session?.user.id !== owner) return false;
  const state = getStreakState(owner, csesUserId);
  const { data: remote, error: fetchError } = await client.from('user_official_solves').select('problem_id,accepted_at').eq('user_id', owner).eq('cses_user_id', csesUserId);
  if (fetchError) return false;
  const remoteMap = new Map((remote || []).map(row => [row.problem_id, row.accepted_at]));
  const rows = Object.entries(state.firstAccepted).map(([problem_id, accepted_at]) => ({ user_id: owner, cses_user_id: csesUserId, problem_id, accepted_at: !remoteMap.has(problem_id) || Date.parse(accepted_at) < Date.parse(remoteMap.get(problem_id)) ? accepted_at : remoteMap.get(problem_id) }));
  if (rows.length) {
    const { error } = await client.from('user_official_solves').upsert(rows, { onConflict: 'user_id,cses_user_id,problem_id' });
    if (error) return false;
  }
  const { data: pref, error: prefFetchError } = await client.from('user_official_streak_preferences').select('timezone').eq('user_id', owner).eq('cses_user_id', csesUserId).maybeSingle();
  if (prefFetchError) return false;
  if (pref?.timezone) setStreakTimezone(owner, csesUserId, pref.timezone);
  else {
    const { error: prefError } = await client.from('user_official_streak_preferences').upsert({ user_id: owner, cses_user_id: csesUserId, timezone: state.timezone }, { onConflict: 'user_id,cses_user_id', ignoreDuplicates: true });
    if (prefError) return false;
    const { data: chosen, error: chosenError } = await client.from('user_official_streak_preferences').select('timezone').eq('user_id', owner).eq('cses_user_id', csesUserId).maybeSingle();
    if (chosenError) return false;
    if (chosen?.timezone) setStreakTimezone(owner, csesUserId, chosen.timezone);
  }
  const { data, error } = await client.from('user_official_solves').select('problem_id,accepted_at').eq('user_id', owner).eq('cses_user_id', csesUserId);
  if (error) return false;
  for (const row of data || []) recordOfficialSolve(owner, csesUserId, row.problem_id, row.accepted_at);
  return true;
}
