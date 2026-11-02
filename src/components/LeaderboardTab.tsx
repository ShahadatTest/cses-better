'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { ProblemStats, LeaderboardEntry, LanguageId, CsesSubmissionSummary } from '@/core/types';
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
  const [selectedCodeEntry, setSelectedCodeEntry] = useState<{
    solverName?: string;
    submissionId?: string;
    language?: string;
    score?: string;
    scoreType?: 'time' | 'size' | 'queue';
    initialCode?: string;
  } | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!problemId) return;
    setIsLoadingQueue(true);
    try {
      const res = await fetch(`/api/cses/submissions/${problemId}`);
      if (res.ok) {
        const data = await res.json();
        setQueueSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.warn('[Queue fetch] Failed to load official submissions queue:', err);
    } finally {
      setIsLoadingQueue(false);
    }
  }, [problemId]);

  useEffect(() => {
    if (activeSubTab === 'queue' && problemId) {
      fetchQueue();
    }
  }, [activeSubTab, problemId, fetchQueue]);

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
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-300/20 text-slate-200 font-bold text-xs border border-slate-300/40">
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
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-2 text-slate-400 font-medium text-xs">
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
            <h4 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
              {title}
            </h4>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Top {entries.length} Solvers
          </span>
        </div>

        {/* Table Content */}
        {entries.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No submissions recorded yet for this benchmark.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-subtle/80 bg-surface-0/30 text-slate-400 font-medium uppercase tracking-wider text-[11px]">
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
                    <td className="py-2.5 px-3.5 font-medium text-slate-200">
                      {onSelectUser ? (
                        <button
                          type="button"
                          onClick={() => onSelectUser(entry.user, entry.userId)}
                          className="inline-flex items-center gap-1 text-slate-200 hover:text-amber-400 transition-colors group cursor-pointer text-left"
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
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-2 text-slate-300 border border-border-subtle">
                        {entry.language}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-semibold">
                      <span
                        className={
                          scoreType === 'time'
                            ? 'text-emerald-400'
                            : 'text-sky-400'
                        }
                      >
                        {entry.score}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={() =>
                          setSelectedCodeEntry({
                            solverName: entry.user,
                            language: entry.language,
                            score: entry.score,
                            scoreType,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 text-sky-400 hover:text-sky-300 border border-border-subtle text-[11px] font-medium transition-colors"
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
                ? 'bg-surface-0 text-slate-100 shadow-sm border border-border-subtle'
                : 'text-slate-400 hover:text-slate-200'
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
                ? 'bg-surface-0 text-slate-100 shadow-sm border border-border-subtle'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <ListOrdered className="w-3.5 h-3.5 text-sky-400" />
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-border-subtle transition-all active:scale-95"
              title="Pull latest live submissions from CSES"
            >
              <RefreshCw
                className={cn('w-3.5 h-3.5 text-sky-400', (isRefreshing || isLoadingQueue) && 'animate-spin')}
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
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Solved By
                  </div>
                  <div className="text-lg font-bold text-slate-100 font-mono truncate">
                    {stats.solvedBy.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Attempted By */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-lg border border-border-subtle bg-surface-1/70 shadow-sm">
                <div className="p-2.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Attempted By
                  </div>
                  <div className="text-lg font-bold text-slate-100 font-mono truncate">
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
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Success Rate
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-100 font-mono">
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
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-semibold text-slate-200">
                    Personal Performance vs Hall of Fame
                  </h3>
                </div>
                {isSolved !== undefined && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                      isSolved
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-700/40 text-slate-300 border-border-subtle'
                    )}
                  >
                    {isSolved ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Solved
                      </>
                    ) : (
                      <>
                        <CircleDot className="w-3.5 h-3.5 text-slate-400" /> Not Solved Yet
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Runtime Comparison */}
                <div className="p-3 rounded-md bg-surface-0/60 border border-border-subtle">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span className="flex items-center gap-1 font-medium text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" /> Runtime
                    </span>
                    {fastestEntry && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        HOF #1: {fastestEntry.score} ({fastestEntry.user})
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-base font-bold font-mono text-slate-100">
                      {userExecutionTimeMs !== undefined
                        ? `${userExecutionTimeMs} ms`
                        : '—'}
                    </div>
                    <div className="text-xs text-slate-400">
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
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span className="flex items-center gap-1 font-medium text-slate-300">
                      <FileCode2 className="w-3.5 h-3.5 text-sky-400" /> Code Size
                    </span>
                    {shortestEntry && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        HOF #1: {shortestEntry.score} ({shortestEntry.user})
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-base font-bold font-mono text-slate-100">
                      {userCharCount !== undefined
                        ? `${userCharCount.toLocaleString()} chars`
                        : '—'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {userCharCount !== undefined && shortestChars > 0
                        ? userCharCount <= shortestChars
                          ? '🎯 Code Golf Master'
                          : `${Math.round((userCharCount / shortestChars) * 10) / 10}x shortest`
                        : 'No code yet'}
                    </div>
                  </div>

                  <div className="w-full bg-surface-3/50 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${sizeEfficiency ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Top 5 Fastest & Shortest Tables */}
          {hasStats ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {renderTable(
                'Fastest Code',
                <Zap className="w-4 h-4 text-emerald-400" />,
                stats.fastest,
                'Runtime',
                'time'
              )}
              {renderTable(
                'Shortest Code',
                <FileCode2 className="w-4 h-4 text-sky-400" />,
                stats.shortest,
                'Characters',
                'size'
              )}
            </div>
          ) : (
            <div className="p-8 text-center rounded-lg border border-border-subtle bg-surface-1/40">
              <Trophy className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-slate-300">
                No Hall of Fame records for this problem yet
              </p>
            </div>
          )}
        </div>
      ) : (
        /* --- LIVE SUBMISSIONS QUEUE TAB --- */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Code2 className="w-4 h-4 text-sky-400" />
              <span>Official CSES Submissions Queue</span>
            </h4>
            <span className="text-xs font-mono text-slate-400">
              {queueSubmissions.length} Submissions Loaded
            </span>
          </div>

          {isLoadingQueue ? (
            <div className="p-12 text-center rounded-xl border border-border-subtle bg-surface-1/40 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span className="text-xs text-slate-400">Fetching original queue submissions from CSES.fi...</span>
            </div>
          ) : queueSubmissions.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-border-subtle bg-surface-1/40 space-y-1">
              <Code2 className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-slate-300">
                No previous submissions recorded on CSES for this problem.
              </p>
              <p className="text-xs text-slate-500">
                Submit your solution using "Submit to CSES" to inspect your live queue status and code.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-1/60">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-0/40 text-slate-400 font-medium uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3.5">Submission ID</th>
                    <th className="py-2.5 px-3.5">Timestamp</th>
                    <th className="py-2.5 px-3.5">Language</th>
                    <th className="py-2.5 px-3.5">Runtime</th>
                    <th className="py-2.5 px-3.5">Size</th>
                    <th className="py-2.5 px-3.5">Verdict</th>
                    <th className="py-2.5 px-3.5 text-right">Original Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {queueSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-surface-2/30 transition-colors">
                      <td className="py-2.5 px-3.5 font-mono font-medium text-sky-400">
                        #{sub.id}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-400 font-mono text-[11px]">
                        {sub.time}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-2 text-slate-300 border border-border-subtle">
                          {sub.language}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-emerald-400 font-semibold">
                        {sub.runtime || '—'}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-slate-300">
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
                              language: sub.language,
                              score: sub.runtime,
                              scoreType: 'queue',
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-medium transition-colors cursor-pointer"
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
          scoreType={selectedCodeEntry.scoreType}
          initialCode={selectedCodeEntry.initialCode}
          onLoadIntoEditor={onSelectCode}
        />
      )}
    </div>
  );
};

export default LeaderboardTab;
