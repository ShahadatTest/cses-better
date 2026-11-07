'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Trophy,
  Zap,
  FileCode2,
  CheckCircle2,
  Users,
  Percent,
  ExternalLink,
  Award,
  CircleDot,
  Clock,
  Sparkles,
  RefreshCw,
  Code2,
  ListOrdered,
  Loader2,
  Eye,
  Search,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { ProblemStats, LeaderboardEntry, LanguageId, CsesSubmissionSummary } from '@/core/types';
import { getStoredCsesSessionCookie } from '@/core/cses-client';
import { normalizeCsesLanguage } from '@/core/cses-history';
import { cn } from '@/lib/utils';
import { CsesCodeViewerModal } from './CsesCodeViewerModal';

export interface LeaderboardTabProps {
  stats?: ProblemStats;
  problemId?: string;
  problemTitle?: string;
  onSelectCode?: (code: string, lang: LanguageId) => void;
  userExecutionTimeMs?: number;
  userCharCount?: number;
  isSolved?: boolean;
  className?: string;
  onSelectUser?: (nick: string, userId?: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastRefreshedAt?: number;
}

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({
  stats,
  problemId,
  problemTitle,
  onSelectCode,
  userExecutionTimeMs,
  userCharCount,
  isSolved,
  className,
  onSelectUser,
  onRefresh,
  isRefreshing = false,
  lastRefreshedAt,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'hof' | 'queue'>('hof');
  const [queueSubmissions, setQueueSubmissions] = useState<CsesSubmissionSummary[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [queueCoverage, setQueueCoverage] = useState<'available' | 'partial' | 'unavailable' | null>(null);
  const [queueCursor, setQueueCursor] = useState<string | null>(null);
  const queueController = useRef<AbortController | null>(null);
  const codeLookup = useRef<AbortController | null>(null);
  const [selectedCodeEntry, setSelectedCodeEntry] = useState<{
    solverName?: string;
    submissionId?: string;
    language?: string;
    score?: string;
    statusText?: string;
    scoreType?: 'time' | 'size' | 'queue';
    initialCode?: string;
    coverage?: 'available' | 'partial' | 'unavailable';
  } | null>(null);

  // Sorting and Filtering State
  const [filterLang, setFilterLang] = useState<string>('all');
  const [filterVerdict, setFilterVerdict] = useState<string>('all');
  const [searchUser, setSearchUser] = useState<string>('');
  const [sortBy, setSortBy] = useState<'rank_asc' | 'score_asc' | 'user_asc'>('rank_asc');
  const [queueSortBy, setQueueSortBy] = useState<'time_desc' | 'time_asc' | 'runtime_asc' | 'size_asc'>('time_desc');

  useEffect(() => () => codeLookup.current?.abort(), []);

  const fetchQueue = useCallback(async (cursor?: string) => {
    if (!problemId) return;
    queueController.current?.abort();
    const controller = new AbortController();
    queueController.current = controller;
    setIsLoadingQueue(true);
    if (!cursor) { setQueueSubmissions([]); setQueueCursor(null); setQueueCoverage(null); }
    try {
      const sessionCookie = getStoredCsesSessionCookie();
      const headers: Record<string, string> = {};
      if (sessionCookie) {
        headers['x-cses-session'] = sessionCookie;
      }
      const query = new URLSearchParams({ language: filterLang, verdict: filterVerdict, user: searchUser.trim(), sort: queueSortBy });
      if (cursor) query.set('cursor', cursor);
      const res = await fetch(`/api/cses/submissions/${problemId}?${query}`, { headers, signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        if (!controller.signal.aborted) {
          setQueueSubmissions(previous => cursor ? [...new Map([...previous, ...(data.submissions || [])].map(row => [row.id, row])).values()] : data.submissions || []);
          setQueueCoverage(data.historicalCoverage || 'unavailable');
          setQueueCursor(data.historyCursor || null);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.warn('[Queue fetch] Failed to load official submissions queue:', err);
      setQueueSubmissions([]);
      setQueueCoverage('unavailable');
    } finally {
      if (!controller.signal.aborted) setIsLoadingQueue(false);
    }
  }, [problemId, filterLang, filterVerdict, searchUser, queueSortBy]);

  useEffect(() => {
    if (activeSubTab !== 'queue' || !problemId) return;
    const timer = setTimeout(() => fetchQueue(), 250);
    return () => { clearTimeout(timer); queueController.current?.abort(); };
  }, [activeSubTab, problemId, fetchQueue]);

  const filterAndSortEntries = useCallback(
    (entries: LeaderboardEntry[] = [], type: 'time' | 'size') => {
      let list = [...entries];
      if (filterLang !== 'all') {
        list = list.filter((e) => e.language.toLowerCase().includes(filterLang.toLowerCase()));
      }
      if (searchUser.trim()) {
        const q = searchUser.trim().toLowerCase();
        list = list.filter(
          (e) =>
            e.user.toLowerCase().includes(q) ||
            e.userId?.toLowerCase().includes(q)
        );
      }
      if (sortBy === 'score_asc') {
        list.sort((a, b) => {
          const valA = parseFloat(a.score.replace(/[^\d.]/g, '') || '9999');
          const valB = parseFloat(b.score.replace(/[^\d.]/g, '') || '9999');
          return valA - valB;
        });
      } else if (sortBy === 'user_asc') {
        list.sort((a, b) => a.user.localeCompare(b.user));
      } else {
        list.sort((a, b) => a.rank - b.rank);
      }
      return list;
    },
    [filterLang, searchUser, sortBy]
  );

  const filteredFastest = useMemo(
    () => filterAndSortEntries(stats?.fastest, 'time'),
    [stats?.fastest, filterAndSortEntries]
  );
  const filteredShortest = useMemo(
    () => filterAndSortEntries(stats?.shortest, 'size'),
    [stats?.shortest, filterAndSortEntries]
  );

  const filteredQueue = useMemo(() => {
    let list = [...queueSubmissions];
    if (filterLang !== 'all') {
      list = list.filter((s) => s.language?.toLowerCase().includes(filterLang.toLowerCase()));
    }
    if (filterVerdict !== 'all') {
      list = list.filter((s) => s.status?.toUpperCase() === filterVerdict.toUpperCase());
    }
    if (searchUser.trim()) {
      const q = searchUser.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.user?.toLowerCase().includes(q) ||
          s.userId?.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }
    if (queueSortBy === 'runtime_asc') {
      list.sort((a, b) => {
        const tA = parseFloat(a.runtime?.replace(/[^\d.]/g, '') || '999');
        const tB = parseFloat(b.runtime?.replace(/[^\d.]/g, '') || '999');
        return tA - tB;
      });
    } else if (queueSortBy === 'size_asc') {
      list.sort((a, b) => {
        const sA = parseInt(a.size?.replace(/\D/g, '') || '999999', 10);
        const sB = parseInt(b.size?.replace(/\D/g, '') || '999999', 10);
        return sA - sB;
      });
    } else if (queueSortBy === 'time_asc') {
      list.sort((a, b) => a.time.localeCompare(b.time));
    } else {
      list.sort((a, b) => b.time.localeCompare(a.time));
    }
    return list;
  }, [queueSubmissions, filterLang, filterVerdict, searchUser, queueSortBy]);

  const openFastestAcceptedCode = async (entry: LeaderboardEntry) => {
    if (!problemId) return;
    codeLookup.current?.abort();
    const controller = new AbortController();
    codeLookup.current = controller;
    const headers: Record<string, string> = {};
    const sessionCookie = getStoredCsesSessionCookie();
    if (sessionCookie) headers['x-cses-session'] = sessionCookie;
    const params = new URLSearchParams({ language: entry.language, verdict: 'ACCEPTED', user: entry.user, sort: 'runtime_asc' });
    try {
      const response = await fetch(`/api/cses/submissions/${problemId}?${params}`, { headers, signal: controller.signal });
      if (!response.ok) throw new Error('Could not inspect this solver’s accepted submissions.');
      const data = await response.json();
      const match = (data.submissions || []).find((submission: CsesSubmissionSummary) =>
        submission.status === 'ACCEPTED' && Boolean(submission.id.match(/^\d+$/)) &&
        (entry.userId ? submission.userId === entry.userId : submission.user?.toLowerCase() === entry.user.toLowerCase()) &&
        normalizeCsesLanguage(submission.language) === normalizeCsesLanguage(entry.language)
      );
      if (!controller.signal.aborted) setSelectedCodeEntry({ solverName: entry.user, submissionId: match?.id, language: match?.language || entry.language, score: match?.runtime || entry.score, scoreType: 'time', statusText: match ? 'ACCEPTED' : undefined, coverage: data.historicalCoverage });
    } catch (error) {
      if (!controller.signal.aborted) {
        console.warn('[Leaderboard code] Failed to find official accepted submission:', error);
        setSelectedCodeEntry({ solverName: entry.user, language: entry.language, score: entry.score, scoreType: 'time' });
      }
    }
  };

  const hasStats =
    stats &&
    (stats.solvedBy > 0 ||
      (stats.fastest && stats.fastest.length > 0) ||
      (stats.shortest && stats.shortest.length > 0));

  const hasUserMetrics =
    userExecutionTimeMs !== undefined ||
    userCharCount !== undefined ||
    isSolved !== undefined;

  // Benchmarks for personal comparison
  const fastestEntry = stats?.fastest?.[0];
  const shortestEntry = stats?.shortest?.[0];

  const fastestSeconds = fastestEntry
    ? parseFloat(fastestEntry.score.replace(/[^\d.]/g, '')) || 0
    : 0;
  const fastestMs = Math.round(fastestSeconds * 1000);

  const shortestChars = shortestEntry
    ? parseInt(shortestEntry.score.replace(/\D/g, ''), 10) || 0
    : 0;

  // Efficiency scores (0 to 100)
  const timeEfficiency =
    userExecutionTimeMs !== undefined && fastestMs >= 0
      ? userExecutionTimeMs <= fastestMs
        ? 100
        : Math.max(
            8,
            Math.min(
              100,
              Math.round(
                (Math.max(1, fastestMs) / Math.max(1, userExecutionTimeMs)) * 100
              )
            )
          )
      : null;

  const sizeEfficiency =
    userCharCount !== undefined && shortestChars > 0
      ? userCharCount <= shortestChars
        ? 100
        : Math.max(
            8,
            Math.min(
              100,
              Math.round((shortestChars / Math.max(1, userCharCount)) * 100)
            )
          )
      : null;

  const renderRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 font-bold text-xs border border-amber-400/40">
            1
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-300/20 text-text-primary font-bold text-xs border border-slate-300/40">
            2
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-700/20 text-amber-500 font-bold text-xs border border-amber-700/40">
            3
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-2 text-text-muted font-medium text-xs">
            {rank}
          </span>
        );
    }
  };

  const renderTable = (
    title: string,
    icon: React.ReactNode,
    entries: LeaderboardEntry[] = [],
    scoreLabel: string,
    scoreType: 'time' | 'size'
  ) => {
    return (
      <div className="flex flex-col rounded-lg border border-border-subtle bg-surface-1/60 overflow-hidden shadow-xs">
        {/* Table Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-1">
          <div className="flex items-center gap-2">
            {icon}
            <h4 className="font-semibold text-xs text-text-primary uppercase tracking-wider">
              {title}
            </h4>
          </div>
          <span className="text-[11px] font-mono text-text-muted">
            Top {entries.length} Solvers
          </span>
        </div>

        {/* Table Content */}
        {entries.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">
            No submissions recorded yet for this benchmark.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-subtle/80 bg-surface-0/30 text-text-muted font-medium uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3.5 w-14">Rank</th>
                  <th className="py-2.5 px-3.5">User</th>
                  <th className="py-2.5 px-3.5">Language</th>
                  <th className="py-2.5 px-3.5 text-right">{scoreLabel}</th>
                  <th className="py-2.5 px-3.5 text-right w-24">Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {entries.map((entry) => (
                  <tr
                    key={`${entry.rank}-${entry.user}`}
                    className="hover:bg-surface-2/30 transition-colors"
                  >
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      {renderRankBadge(entry.rank)}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-text-primary">
                      {onSelectUser ? (
                        <button
                          type="button"
                          onClick={() => onSelectUser(entry.user, entry.userId)}
                          className="inline-flex items-center gap-1 text-text-primary hover:text-amber-400 transition-colors group cursor-pointer text-left"
                          title={`Inspect ${entry.user}'s CSES Profile${entry.userId ? ` (#${entry.userId})` : ''}`}
                        >
                          <span className="truncate max-w-[110px] sm:max-w-[160px] underline decoration-zinc-600 underline-offset-2 group-hover:decoration-amber-400">
                            {entry.user}
                          </span>
                          {entry.userId && (
                            <span className="text-[10px] text-zinc-500 font-mono">
                              #{entry.userId}
                            </span>
                          )}
                          <Award className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity text-amber-400" />
                        </button>
                      ) : (
                        <span className="truncate max-w-[120px]">{entry.user}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-2 text-text-secondary border border-border-subtle">
                        {entry.language}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-semibold">
                      <span
                        className={
                          scoreType === 'time'
                            ? 'text-emerald-400'
                            : 'text-accent'
                        }
                      >
                        {entry.score}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={() => openFastestAcceptedCode(entry)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 text-accent hover:text-accent border border-border-subtle text-[11px] font-medium transition-colors"
                        title={`View ${entry.user}'s code pattern & benchmarks`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>Code</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('space-y-5', className)}>
      {/* Sub-tab Navigation: Hall of Fame vs Submissions Queue */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-xl border border-border-subtle bg-surface-1/90 shadow-sm">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface-2/60 border border-border-subtle">
          <button
            onClick={() => setActiveSubTab('hof')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
              activeSubTab === 'hof'
                ? 'bg-surface-0 text-text-primary shadow-sm border border-border-subtle'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Official CSES Live Standings</span>
          </button>

          <button
            onClick={() => setActiveSubTab('queue')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
              activeSubTab === 'queue'
                ? 'bg-surface-0 text-text-primary shadow-sm border border-border-subtle'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <ListOrdered className="w-3.5 h-3.5 text-accent" />
            <span>Official Submissions Queue</span>
          </button>
        </div>

        {/* Live Refresh Trigger */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={() => {
                if (activeSubTab === 'queue') {
                  fetchQueue();
                } else {
                  onRefresh();
                }
              }}
              disabled={isRefreshing || isLoadingQueue}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 text-text-primary hover:text-white rounded-lg text-xs font-medium border border-border-subtle transition-all active:scale-95"
              title="Pull latest live submissions from CSES"
            >
              <RefreshCw
                className={cn('w-3.5 h-3.5 text-accent', (isRefreshing || isLoadingQueue) && 'animate-spin')}
              />
              <span>{isRefreshing || isLoadingQueue ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'hof' ? (
        /* --- HALL OF FAME TAB --- */
        <div className="space-y-5">
          {/* 1. Official Task Summary Metrics */}
          {hasStats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Solved By */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-lg border border-border-subtle bg-surface-1/70 shadow-sm">
                <div className="p-2.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Solved By
                  </div>
                  <div className="text-lg font-bold text-text-primary font-mono truncate">
                    {stats.solvedBy.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Attempted By */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-lg border border-border-subtle bg-surface-1/70 shadow-sm">
                <div className="p-2.5 rounded-md bg-accent/10 text-accent border border-accent/20 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Attempted By
                  </div>
                  <div className="text-lg font-bold text-text-primary font-mono truncate">
                    {stats.attemptedBy.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Success Rate */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-lg border border-border-subtle bg-surface-1/70 shadow-sm">
                <div className="p-2.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                  <Percent className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Success Rate
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-text-primary font-mono">
                      {stats.successRate || '0.0%'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      CSES Official
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Interactive Personal Comparison Scorecard */}
          {hasUserMetrics && (
            <div className="p-4 rounded-lg border border-border-muted bg-gradient-to-br from-surface-1 to-surface-2/60 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    Personal Performance vs Hall of Fame
                  </h3>
                </div>
                {isSolved !== undefined && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                      isSolved
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-700/40 text-text-secondary border-border-subtle'
                    )}
                  >
                    {isSolved ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Solved
                      </>
                    ) : (
                      <>
                        <CircleDot className="w-3.5 h-3.5 text-text-muted" /> Not Solved Yet
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Runtime Comparison */}
                <div className="p-3 rounded-md bg-surface-0/60 border border-border-subtle">
                  <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                    <span className="flex items-center gap-1 font-medium text-text-secondary">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" /> Runtime
                    </span>
                    {fastestEntry && (
                      <span className="text-[11px] text-text-muted font-mono">
                        HOF #1: {fastestEntry.score} ({fastestEntry.user})
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-base font-bold font-mono text-text-primary">
                      {userExecutionTimeMs !== undefined
                        ? `${userExecutionTimeMs} ms`
                        : '—'}
                    </div>
                    <div className="text-xs text-text-muted">
                      {userExecutionTimeMs !== undefined && fastestEntry
                        ? userExecutionTimeMs <= fastestMs
                          ? '⚡ Top Tier Speed'
                          : `+${Math.max(0, userExecutionTimeMs - fastestMs)} ms from record`
                        : 'No submission yet'}
                    </div>
                  </div>

                  <div className="w-full bg-surface-3/50 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${timeEfficiency ?? 0}%` }}
                    />
                  </div>
                </div>

                {/* Code Size Comparison */}
                <div className="p-3 rounded-md bg-surface-0/60 border border-border-subtle">
                  <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                    <span className="flex items-center gap-1 font-medium text-text-secondary">
                      <FileCode2 className="w-3.5 h-3.5 text-accent" /> Code Size
                    </span>
                    {shortestEntry && (
                      <span className="text-[11px] text-text-muted font-mono">
                        HOF #1: {shortestEntry.score} ({shortestEntry.user})
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-base font-bold font-mono text-text-primary">
                      {userCharCount !== undefined
                        ? `${userCharCount.toLocaleString()} chars`
                        : '—'}
                    </div>
                    <div className="text-xs text-text-muted">
                      {userCharCount !== undefined && shortestChars > 0
                        ? userCharCount <= shortestChars
                          ? '🎯 Code Golf Master'
                          : `${Math.round((userCharCount / shortestChars) * 10) / 10}x shortest`
                        : 'No code yet'}
                    </div>
                  </div>

                  <div className="w-full bg-surface-3/50 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-accent h-full rounded-full transition-all duration-500"
                      style={{ width: `${sizeEfficiency ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Sort & Filter Controls for Standings */}
          {hasStats && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl border border-border-subtle bg-surface-1/80 text-xs shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                {/* Search solver */}
                <div className="relative min-w-[130px] sm:min-w-[160px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Search solver..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Filter Language */}
                <select
                  value={filterLang}
                  onChange={(e) => setFilterLang(e.target.value)}
                  className="bg-surface-2 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="all">All Languages</option>
                  <option value="c++">C++</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="rust">Rust</option>
                  <option value="go">Go</option>
                  <option value="pascal">Pascal</option>
                  <option value="c">C</option>
                </select>

                {/* Sort By */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-surface-2 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="rank_asc">Sort: Rank (Best First)</option>
                  <option value="score_asc">Sort: Score</option>
                  <option value="user_asc">Sort: Solver Name (A-Z)</option>
                </select>
              </div>

              {(filterLang !== 'all' || searchUser.trim() || sortBy !== 'rank_asc') && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterLang('all');
                    setSearchUser('');
                    setSortBy('rank_asc');
                  }}
                  className="text-xs text-accent hover:underline cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}

          {/* 4. Top Fastest & Shortest Tables */}
          {hasStats ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {renderTable(
                'Fastest Code',
                <Zap className="w-4 h-4 text-emerald-400" />,
                filteredFastest,
                'Runtime',
                'time'
              )}
              {renderTable(
                'Shortest Code',
                <FileCode2 className="w-4 h-4 text-accent" />,
                filteredShortest,
                'Characters',
                'size'
              )}
            </div>
          ) : (
            <div className="p-8 text-center rounded-lg border border-border-subtle bg-surface-1/40">
              <Trophy className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-text-secondary">
                No Hall of Fame records for this problem yet
              </p>
            </div>
          )}
        </div>
      ) : (
        /* --- LIVE SUBMISSIONS QUEUE TAB --- */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-xs text-text-primary uppercase tracking-wider flex items-center gap-2">
              <Code2 className="w-4 h-4 text-accent" />
              <span>Official CSES Submissions Queue</span>
            </h4>
            <span className="text-xs font-mono text-text-muted">
              {queueSubmissions.length} Submissions Loaded
            </span>
          </div>

          {/* Queue Filter & Sort Bar */}
          {queueSubmissions.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl border border-border-subtle bg-surface-1/80 text-xs shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[130px] sm:min-w-[160px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Search solver..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                <select
                  value={filterLang}
                  onChange={(e) => setFilterLang(e.target.value)}
                  className="bg-surface-2 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="all">All Languages</option>
                  <option value="c++">C++</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="rust">Rust</option>
                  <option value="go">Go</option>
                  <option value="c">C</option>
                </select>

                <select
                  value={filterVerdict}
                  onChange={(e) => setFilterVerdict(e.target.value)}
                  className="bg-surface-2 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="all">All Verdicts</option>
                  <option value="ACCEPTED">Accepted (AC)</option>
                  <option value="FAILED">Failed</option>
                </select>

                <select
                  value={queueSortBy}
                  onChange={(e) => setQueueSortBy(e.target.value as any)}
                  className="bg-surface-2 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="time_desc">Sort: Newest First</option>
                  <option value="time_asc">Sort: Oldest First</option>
                  <option value="runtime_asc">Sort: Fastest Runtime</option>
                  <option value="size_asc">Sort: Shortest Code</option>
                </select>
              </div>

              {queueCoverage && queueCoverage !== 'available' && (
                <p className="text-[11px] text-amber-300" role="status">
                  {queueCoverage === 'partial' ? 'Showing only the historical queue pages CSES exposed in this request; this is not a complete history.' : 'CSES did not expose a readable submissions queue for this problem.'}
                </p>
              )}

              <div className="flex items-center gap-2 text-text-muted text-[11px]">
                <span>Showing {filteredQueue.length} of {queueSubmissions.length}</span>
                {queueCursor && (
                  <button type="button" onClick={() => fetchQueue(queueCursor)} disabled={isLoadingQueue} className="text-accent hover:underline disabled:opacity-50">
                    Load older
                  </button>
                )}
                {(filterLang !== 'all' || filterVerdict !== 'all' || searchUser.trim() || queueSortBy !== 'time_desc') && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterLang('all');
                      setFilterVerdict('all');
                      setSearchUser('');
                      setQueueSortBy('time_desc');
                    }}
                    className="text-accent hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {isLoadingQueue ? (
            <div className="p-12 text-center rounded-xl border border-border-subtle bg-surface-1/40 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span className="text-xs text-text-muted">Fetching original queue submissions from CSES.fi...</span>
            </div>
          ) : queueSubmissions.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-border-subtle bg-surface-1/40 space-y-1">
              <Code2 className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-text-secondary">
                No previous submissions recorded on CSES for this problem.
              </p>
              <p className="text-xs text-text-muted">
                Submit your solution using "Submit to CSES" to inspect your live queue status and code.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-1/60">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-0/40 text-text-muted font-medium uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3.5">ID</th>
                    <th className="py-2.5 px-3.5">User</th>
                    <th className="py-2.5 px-3.5">Timestamp</th>
                    <th className="py-2.5 px-3.5">Language</th>
                    <th className="py-2.5 px-3.5">Runtime</th>
                    <th className="py-2.5 px-3.5">Size</th>
                    <th className="py-2.5 px-3.5">Verdict</th>
                    <th className="py-2.5 px-3.5 text-right">Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {filteredQueue.map((sub) => (
                    <tr key={sub.id} className="hover:bg-surface-2/30 transition-colors">
                      <td className="py-2.5 px-3.5 font-mono font-medium text-accent">
                        #{sub.id}
                      </td>
                      <td className="py-2.5 px-3.5">
                        {sub.userId || sub.user ? (
                          <button
                            type="button"
                            onClick={() => onSelectUser?.(sub.user || 'Unknown', sub.userId)}
                            className="text-accent hover:text-accent hover:underline font-mono inline-flex items-center gap-1 font-medium cursor-pointer"
                            title={`Inspect official profile for ${sub.user}`}
                          >
                            <span>{sub.user || 'User'}</span>
                            {sub.userId && <span className="text-[10px] text-text-muted font-normal">#{sub.userId}</span>}
                          </button>
                        ) : (
                          <span className="text-text-muted">Unknown</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-text-muted font-mono text-[11px]">
                        {sub.time}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-2 text-text-secondary border border-border-subtle">
                          {sub.language}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-emerald-400 font-semibold">
                        {sub.runtime || '—'}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-text-secondary">
                        {sub.size || '—'}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase border',
                            sub.status === 'ACCEPTED'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          )}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right">
                        <button
                          onClick={() =>
                            setSelectedCodeEntry({
                              submissionId: sub.id,
                              solverName: sub.user || 'CSES Submitter',
                              language: sub.language,
                              score: sub.runtime,
                              statusText: sub.status,
                              scoreType: 'queue',
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 text-xs font-medium transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Code</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Code Viewer Modal */}
      {selectedCodeEntry && (
        <CsesCodeViewerModal
          isOpen={Boolean(selectedCodeEntry)}
          onClose={() => setSelectedCodeEntry(null)}
          submissionId={selectedCodeEntry.submissionId}
          solverName={selectedCodeEntry.solverName}
          problemId={problemId}
          problemTitle={problemTitle}
          language={selectedCodeEntry.language}
          score={selectedCodeEntry.score}
          statusText={selectedCodeEntry.statusText}
          scoreType={selectedCodeEntry.scoreType}
          initialCode={selectedCodeEntry.initialCode}
          coverage={selectedCodeEntry.coverage}
          onLoadIntoEditor={onSelectCode}
        />
      )}
    </div>
  );
};

export default LeaderboardTab;
