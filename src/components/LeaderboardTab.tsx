'use client';

import React from 'react';
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
} from 'lucide-react';
import { ProblemStats, LeaderboardEntry } from '@/core/types';
import { cn } from '@/lib/utils';

export interface LeaderboardTabProps {
  stats?: ProblemStats;
  userExecutionTimeMs?: number;
  userCharCount?: number;
  isSolved?: boolean;
  className?: string;
  onSelectUser?: (nick: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastRefreshedAt?: number;
}

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({
  stats,
  userExecutionTimeMs,
  userCharCount,
  isSolved,
  className,
  onSelectUser,
  onRefresh,
  isRefreshing = false,
  lastRefreshedAt,
}) => {
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Award className="w-3.5 h-3.5 text-amber-400" /> #1
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-400/15 text-slate-200 border border-slate-400/30">
            <Award className="w-3.5 h-3.5 text-slate-300" /> #2
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-700/20 text-amber-500 border border-amber-700/40">
            <Award className="w-3.5 h-3.5 text-amber-600" /> #3
          </span>
        );
      default:
        return (
          <span className="text-xs font-mono text-slate-400 pl-2">
            #{rank}
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
      <div className="flex flex-col rounded-lg border border-border-subtle bg-surface-1/60 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-2/40">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-semibold text-slate-200 tracking-wide">
              {title}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Top 5 Records</span>
        </div>

        {entries.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No record entries available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-subtle/80 bg-surface-0/30 text-slate-400 font-medium uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3.5 w-16">Rank</th>
                  <th className="py-2.5 px-3.5">User</th>
                  <th className="py-2.5 px-3.5">Language</th>
                  <th className="py-2.5 px-3.5 text-right">{scoreLabel}</th>
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
                          onClick={() => onSelectUser(entry.user)}
                          className="inline-flex items-center gap-1 text-slate-200 hover:text-amber-400 transition-colors group cursor-pointer text-left"
                          title={`Inspect ${entry.user}'s CSES Profile`}
                        >
                          <span className="truncate max-w-[120px] sm:max-w-[180px] underline decoration-zinc-600 underline-offset-2 group-hover:decoration-amber-400">
                            {entry.user}
                          </span>
                          <Award className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity text-amber-400" />
                        </button>
                      ) : (
                        <a
                          href={`https://cses.fi/problemset/user/${encodeURIComponent(
                            entry.user
                          )}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-slate-200 hover:text-sky-400 transition-colors group"
                        >
                          <span className="truncate max-w-[120px] sm:max-w-[180px]">
                            {entry.user}
                          </span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                        </a>
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
    <div className={cn('space-y-6', className)}>
      {/* Live Cache & Refresh Toolbar */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-surface-1/90 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-200">
            Official CSES Live Standings
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {lastRefreshedAt
              ? `• Updated ${Math.round((Date.now() - lastRefreshedAt) / 1000)}s ago`
              : '• Live Synced'}
          </span>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 text-slate-200 hover:text-white rounded-md text-xs font-medium border border-border-subtle transition-all active:scale-95"
            title="Bypass cache and pull latest submissions from CSES.fi"
          >
            <RefreshCw
              className={cn('w-3.5 h-3.5 text-sky-400', isRefreshing && 'animate-spin')}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Standings'}</span>
          </button>
        )}
      </div>

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
      {hasUserMetrics ? (
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

              {/* Progress bar */}
              <div className="w-full bg-surface-3/50 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${timeEfficiency ?? 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>0 ms</span>
                <span>
                  {timeEfficiency !== null ? `${timeEfficiency}% efficiency` : '—'}
                </span>
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

              {/* Progress bar */}
              <div className="w-full bg-surface-3/50 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-sky-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${sizeEfficiency ?? 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>Golf record: {shortestChars || '—'} ch</span>
                <span>
                  {sizeEfficiency !== null ? `${sizeEfficiency}% golf ratio` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-2/20 flex items-center gap-3 text-xs text-slate-400">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            Submit or run your code in the editor to compare your runtime and
            code length directly against the CSES Hall of Fame.
          </span>
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
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Metrics are compiled from the official CSES problemset standings.
          </p>
        </div>
      )}
    </div>
  );
};

export default LeaderboardTab;
