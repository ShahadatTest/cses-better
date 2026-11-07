'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { getStoredCsesCredentials, getStoredCsesSessionCookie } from '@/core/cses-client';
import { getStreakBackfill, getStreakState, recordOfficialSolve, saveStreakBackfill, syncOfficialSolves } from '@/core/streaks';

export default function StreakIndicator({ owner = 'guest', onConnect }: { owner?: string; onConnect?: () => void }) {
  const [account, setAccount] = useState(() => getStoredCsesCredentials());
  const [state, setState] = useState(() => getStreakState(owner, getStoredCsesCredentials()?.userId || getStoredCsesCredentials()?.nick || ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const csesUserId = account?.userId || account?.nick || '';
  const identity = `${owner}:${csesUserId}`;
  const identityRef = useRef(identity);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  identityRef.current = identity;
  const refresh = () => setState(getStreakState(owner, csesUserId));
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; controllerRef.current?.abort(); }; }, []);
  useEffect(() => { setMessage(''); setProgress(null); }, [identity]);
  useEffect(() => {
    const update = () => { setAccount(getStoredCsesCredentials()); refresh(); };
    window.addEventListener('cses-account-changed', update);
    window.addEventListener('cses-streaks-changed', refresh);
    window.addEventListener('storage', update);
    const timer = window.setInterval(refresh, 60000);
    update();
    return () => { controllerRef.current?.abort(); window.clearInterval(timer); window.removeEventListener('cses-account-changed', update); window.removeEventListener('cses-streaks-changed', refresh); window.removeEventListener('storage', update); };
  }, [owner, csesUserId]);
  useEffect(() => { refresh(); }, [owner, csesUserId]);
  useEffect(() => {
    if (owner !== 'guest' && csesUserId) void syncOfficialSolves(owner, csesUserId).then(synced => { refresh(); if (!synced) setMessage('Cloud sync will retry'); }).catch(() => setMessage('Cloud sync will retry'));
  }, [owner, csesUserId]);

  const importHistory = async () => {
    if (busy) { controllerRef.current?.abort(); setMessage('Pausing history import…'); return; }
    const cookie = getStoredCsesSessionCookie();
    if (!account || !cookie || !csesUserId) { onConnect?.(); return; }
    setBusy(true); setMessage(''); setProgress(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    const startedFor = identity;
    let imported = false;
    try {
      const saved = getStreakBackfill(owner, csesUserId);
      let { cursor, complete } = saved;
      let finished = saved.finished ?? complete;
      let hasGaps = saved.hasGaps ?? false;
      if (saved.processed !== undefined && saved.total !== undefined) setProgress({ processed: saved.processed, total: saved.total });
      if (finished && hasGaps) {
        cursor = null; complete = false; finished = false; hasGaps = false;
        saveStreakBackfill(owner, csesUserId, null, false, undefined, saved.processed !== undefined && saved.total !== undefined ? { processed: saved.processed, total: saved.total } : undefined, { finished: false, hasGaps: false });
      }
      if (finished) {
        const synced = owner !== 'guest' && await syncOfficialSolves(owner, csesUserId);
        if (!mountedRef.current || identityRef.current !== startedFor) return;
        setMessage(`${hasGaps ? 'Accessible history imported; some timestamps were unavailable.' : 'History import complete.'} ${synced ? 'Cloud sync complete.' : 'Cloud sync will retry.'}`);
        return;
      }
      let incompleteReason = saved.incompleteReason || '';
      let cloudSynced: boolean | undefined;
      const seenCursors = new Set(cursor ? [cursor] : []);
      while (!finished && !controller.signal.aborted) {
        const response = await fetch(`/api/cses/history?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { headers: { 'x-cses-session': cookie }, signal: controller.signal });
        if (!response.ok) throw new Error('History request failed');
        const page = await response.json();
        const current = getStoredCsesCredentials(), currentId = current?.userId || current?.nick || '';
        if (controller.signal.aborted || identityRef.current !== startedFor || currentId !== csesUserId) return;
        if (!Array.isArray(page.entries) || typeof page.complete !== 'boolean' || (page.nextCursor !== null && typeof page.nextCursor !== 'string')) throw new Error('Invalid history response');
        for (const entry of page.entries) {
          if (entry?.problemId && entry.csesUserId === csesUserId && typeof entry.acceptedAt === 'string') recordOfficialSolve(owner, csesUserId, entry.problemId, entry.acceptedAt);
        }
        imported ||= page.entries.length > 0;
        const pageReason = typeof page.incompleteReason === 'string' ? page.incompleteReason : '';
        const nextCursor = page.nextCursor as string | null;
        const cursorStalled = !!nextCursor && seenCursors.has(nextCursor);
        finished = nextCursor === null;
        hasGaps ||= Number(page.omittedCount) > 0 || (finished && !page.complete);
        if (hasGaps && pageReason && !incompleteReason.includes(pageReason)) incompleteReason = [incompleteReason, pageReason].filter(Boolean).join(' ');
        if (cursorStalled) incompleteReason = 'History cursor stopped advancing; retry later.';
        const pageProgress = Number.isFinite(page.processed) && Number.isFinite(page.total) ? { processed: page.processed, total: page.total } : undefined;
        complete = finished && !hasGaps;
        saveStreakBackfill(owner, csesUserId, cursorStalled ? cursor : nextCursor, complete, incompleteReason, pageProgress, { finished, hasGaps });
        if (pageProgress) setProgress(pageProgress);
        cursor = nextCursor && seenCursors.has(nextCursor) ? cursor : nextCursor;
        if (cursor) seenCursors.add(cursor);
        if (cursorStalled || (!finished && !cursor)) break;
      }
      if ((imported || finished) && owner !== 'guest') cloudSynced = await syncOfficialSolves(owner, csesUserId);
      if (!mountedRef.current || identityRef.current !== startedFor) return;
      refresh();
      if (controller.signal.aborted) setMessage('History import paused; progress is saved.');
      else if (finished && hasGaps) setMessage(`Accessible history imported; some timestamps were unavailable. ${incompleteReason} ${cloudSynced === false ? 'Cloud sync will retry.' : ''}`);
      else if (complete) setMessage(`History import complete. ${cloudSynced === false ? 'Cloud sync will retry.' : ''}`);
      else setMessage(`Partial history: ${incompleteReason || (cursor ? 'more pages remain.' : 'no resume cursor was returned; retrying starts again.')}`);
    } catch (error) {
      if (!mountedRef.current || identityRef.current !== startedFor) return;
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) setMessage('History import paused; progress is saved.');
      else setMessage(error instanceof Error ? error.message : 'Could not import history');
    } finally { if (controllerRef.current === controller) controllerRef.current = null; if (mountedRef.current) setBusy(false); }
  };

  const days = new Set(state.recentDays), today = new Intl.DateTimeFormat('en-CA', { timeZone: state.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const backfill = getStreakBackfill(owner, csesUserId);
  return <details className="relative shrink-0 text-sm text-amber-300" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.removeAttribute('open'); event.currentTarget.querySelector('summary')?.focus(); } }}>
    <summary className="flex shrink-0 cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded px-2 py-1 hover:bg-amber-500/10">
      <Flame className="h-4 w-4" aria-hidden="true" /><span>{state.current} day streak</span>
    </summary>
    <div className="fixed left-3 right-3 top-14 z-50 max-h-[calc(100vh-4.5rem)] w-auto overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-zinc-100 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[80vh] sm:w-72">
      <p className="font-semibold">{state.current} day current · {state.longest} day longest</p>
      <div className="mt-3 grid grid-cols-7 gap-1" aria-label="Recent solve activity">
        {Array.from({ length: 35 }, (_, i) => { const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - (34 - i)); const day = date.toISOString().slice(0, 10); return <span key={day} title={`${day}${days.has(day) ? ': solved' : ''}`} className={`h-6 rounded-sm ${days.has(day) ? 'bg-amber-400' : 'bg-zinc-700'}`} />; })}
      </div>
      <p className="mt-2 text-xs text-zinc-400">Timezone: {state.timezone}</p>
      <p className="mt-1 text-xs text-zinc-400">{backfill.complete ? 'Full history imported' : backfill.finished && backfill.hasGaps ? 'Accessible history imported; some timestamps were unavailable' : backfill.incompleteReason || 'Streaks include accepted solves retrieved so far'}</p>
      {(progress || (backfill.processed !== undefined && backfill.total !== undefined)) && <p className="mt-1 text-xs text-zinc-400">History scan: {(progress || backfill).processed}/{(progress || backfill).total} tasks</p>}
      {message && <p role="status" className="mt-2 text-xs text-zinc-300">{message}</p>}
      <button type="button" onClick={account ? importHistory : onConnect} className="mt-3 rounded border border-amber-500/30 px-2 py-1 text-xs text-amber-200">
        {busy ? 'Pause import' : account ? (backfill.finished && backfill.hasGaps ? 'Retry incomplete history' : backfill.finished ? 'History scanned' : 'Import / continue history') : 'Connect CSES'}
      </button>
    </div>
  </details>;
}
