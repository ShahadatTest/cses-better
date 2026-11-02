'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  HardDrive,
  FileCode2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Inbox,
  Code2,
  RefreshCw,
  Loader2,
  Eye,
  Globe,
  Laptop,
} from 'lucide-react';
import { SubmissionRecord, LanguageId, VerdictStatus, CsesSubmissionSummary } from '@/core/types';
import { cn } from '@/lib/utils';
import { CsesCodeViewerModal } from './CsesCodeViewerModal';

export interface SubmissionsTabProps {
  submissions: SubmissionRecord[];
  onSelectCode: (code: string, lang: LanguageId) => void;
  problemId?: string;
  problemTitle?: string;
  onSelectUser?: (nick: string, userId?: string) => void;
  className?: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  cpp: 'C++',
  python: 'Python',
  java: 'Java',
  rust: 'Rust',
  go: 'Go',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  c: 'C',
};

function formatTimestamp(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatExactDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

function getStatusConfig(status: VerdictStatus) {
  switch (status) {
    case 'AC':
      return {
        label: 'Accepted',
        code: 'AC',
        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        icon: CheckCircle2,
      };
    case 'WA':
      return {
        label: 'Wrong Answer',
        code: 'WA',
        className: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        icon: XCircle,
      };
    case 'TLE':
      return {
        label: 'Time Limit',
        code: 'TLE',
        className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        icon: Clock,
      };
    case 'MLE':
      return {
        label: 'Memory Limit',
        code: 'MLE',
        className: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        icon: HardDrive,
      };
    case 'CE':
      return {
        label: 'Compile Error',
        code: 'CE',
        className: 'bg-red-500/15 text-red-400 border-red-500/30',
        icon: AlertTriangle,
      };
    case 'RE':
      return {
        label: 'Runtime Error',
        code: 'RE',
        className: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
        icon: AlertTriangle,
      };
    default:
      return {
        label: 'Pending',
        code: 'PENDING',
        className: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
        icon: RotateCcw,
      };
  }
}

export const SubmissionsTab: React.FC<SubmissionsTabProps> = ({
  submissions,
  onSelectCode,
  problemId,
  problemTitle,
  onSelectUser,
  className,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'cses_queue' | 'local'>('local');
  const [queueSubmissions, setQueueSubmissions] = useState<CsesSubmissionSummary[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [selectedCodeEntry, setSelectedCodeEntry] = useState<{
    submissionId?: string;
    solverName?: string;
    language?: string;
    score?: string;
    scoreType?: 'time' | 'size' | 'queue';
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
    if (problemId) {
      fetchQueue();
    }
  }, [problemId, fetchQueue]);

  const handleCopyCode = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleLoadCode = (id: string, code: string, lang: LanguageId) => {
    onSelectCode(code, lang);
    setLoadedId(id);
    setTimeout(() => setLoadedId(null), 1500);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface-0/60 border border-border-subtle">
          <button
            type="button"
            onClick={() => setActiveSubTab('cses_queue')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
              activeSubTab === 'cses_queue'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
            )}
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>Official CSES Queue</span>
            {queueSubmissions.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/30 text-sky-200 font-mono">
                {queueSubmissions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('local')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
              activeSubTab === 'local'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
            )}
          >
            <Laptop className="w-3.5 h-3.5 text-slate-400" />
            <span>My Workbench Runs</span>
            {submissions.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-surface-2 text-slate-300 font-mono">
                {submissions.length}
              </span>
            )}
          </button>
        </div>

        {activeSubTab === 'cses_queue' && (
          <button
            type="button"
            onClick={fetchQueue}
            disabled={isLoadingQueue}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-sky-300 bg-surface-2/60 hover:bg-surface-2 border border-border-subtle transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh CSES live queue submissions"
          >
            <RefreshCw className={cn('w-3 h-3', isLoadingQueue && 'animate-spin text-sky-400')} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* VIEW 1: OFFICIAL CSES QUEUE */}
      {activeSubTab === 'cses_queue' && (
        <div className="space-y-3">
          {isLoadingQueue ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-3 rounded-xl border border-border-subtle bg-surface-1/40">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span className="text-xs text-slate-400">Fetching live submissions queue from CSES.fi...</span>
            </div>
          ) : queueSubmissions.length === 0 ? (
            <div className="p-10 text-center rounded-xl border border-border-subtle bg-surface-1/40 space-y-2">
              <Code2 className="w-8 h-8 text-slate-500 mx-auto mb-1 opacity-50" />
              <p className="text-sm font-medium text-slate-200">
                No submissions found in CSES queue for task #{problemId}.
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Use the "Submit to CSES" action in the editor workbench to submit your code directly to the official CSES judges.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-1/60">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-0/40 text-slate-400 font-medium uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3.5">ID</th>
                    <th className="py-2.5 px-3.5">User</th>
                    <th className="py-2.5 px-3.5">Sent At</th>
                    <th className="py-2.5 px-3.5">Language</th>
                    <th className="py-2.5 px-3.5">Runtime</th>
                    <th className="py-2.5 px-3.5">Size</th>
                    <th className="py-2.5 px-3.5">Verdict</th>
                    <th className="py-2.5 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {queueSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-surface-2/30 transition-colors">
                      <td className="py-2.5 px-3.5 font-mono font-medium text-sky-400">
                        #{sub.id}
                      </td>
                      <td className="py-2.5 px-3.5">
                        {sub.userId || sub.user ? (
                          <button
                            type="button"
                            onClick={() => onSelectUser?.(sub.user || 'Unknown', sub.userId)}
                            className="text-sky-400 hover:text-sky-300 hover:underline font-mono inline-flex items-center gap-1 font-medium cursor-pointer"
                            title={`Inspect official profile for ${sub.user}`}
                          >
                            <span>{sub.user || 'User'}</span>
                            {sub.userId && (
                              <span className="text-[10px] text-slate-500 font-normal">
                                #{sub.userId}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-500">Unknown</span>
                        )}
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
                          type="button"
                          onClick={() =>
                            setSelectedCodeEntry({
                              submissionId: sub.id,
                              solverName: sub.user || 'CSES Submitter',
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

      {/* VIEW 2: LOCAL WORKBENCH RUNS */}
      {activeSubTab === 'local' && (
        <div className="space-y-3">
          {submissions.length === 0 ? (
            <div className="p-10 text-center rounded-xl border border-border-subtle bg-surface-1/40 space-y-2">
              <Inbox className="w-8 h-8 text-slate-500 mx-auto mb-1 opacity-50" />
              <p className="text-sm font-semibold text-slate-200">
                No submissions yet
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Run testcases or submit your code in the editor to record local verdicts, memory benchmarks, and diff revisions.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {submissions.map((sub) => {
                const statusConfig = getStatusConfig(sub.status);
                const StatusIcon = statusConfig.icon;
                const isExpanded = expandedId === sub.id;
                const memoryMb = (sub.maxMemoryBytes / (1024 * 1024)).toFixed(1);
                const langDisplay = LANGUAGE_LABELS[sub.language] || sub.language;

                return (
                  <div
                    key={sub.id}
                    className="rounded-lg border border-border-subtle bg-surface-1/70 transition-all hover:border-border-muted overflow-hidden shadow-xs"
                  >
                    {/* Header Row */}
                    <div className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                            statusConfig.className
                          )}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          <span>{statusConfig.label}</span>
                        </span>

                        <span className="text-xs text-slate-300 font-medium">
                          {sub.passedCount} / {sub.totalCount} passed
                        </span>

                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-2 text-slate-300 border border-border-subtle">
                          {langDisplay}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="font-mono text-emerald-400 font-medium">
                          {sub.maxTimeMs} ms
                        </span>
                        <span className="font-mono text-slate-400">
                          {memoryMb} MB
                        </span>
                        {sub.charCount !== undefined && (
                          <span className="font-mono text-slate-400">
                            {sub.charCount} ch.
                          </span>
                        )}
                        <span title={formatExactDate(sub.timestamp)}>
                          {formatTimestamp(sub.timestamp)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleLoadCode(sub.id, sub.code, sub.language)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors border cursor-pointer',
                            loadedId === sub.id
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-surface-2 hover:bg-surface-3 text-slate-200 hover:text-white border-border-subtle'
                          )}
                          title="Load this submission's code into the editor"
                        >
                          {loadedId === sub.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Loaded</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3 text-sky-400" />
                              <span>Load Code</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleLoadCode(sub.id, sub.code, sub.language)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors border cursor-pointer',
                            loadedId === sub.id
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-surface-2 hover:bg-surface-3 text-slate-200 hover:text-white border-border-subtle'
                          )}
                          title="Load this submission's code into the editor"
                        >
                          {loadedId === sub.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Loaded</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3 text-sky-400" />
                              <span>Load Code</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                          className="p-1 rounded hover:bg-surface-2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                          title={isExpanded ? 'Collapse code' : 'View code'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Code Body */}
                    {isExpanded && (
                      <div className="border-t border-border-subtle bg-surface-0/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                            <FileCode2 className="w-3.5 h-3.5 text-sky-400" />
                            <span>Submitted Source Code ({sub.charCount} characters)</span>
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyCode(sub.id, sub.code)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            >
                              {copiedId === sub.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleLoadCode(sub.id, sub.code, sub.language)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{loadedId === sub.id ? 'Loaded!' : 'Load Code'}</span>
                            </button>
                          </div>
                        </div>

                        <pre className="p-3.5 rounded-lg bg-surface-0 border border-border-subtle font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre leading-relaxed select-all max-h-96">
                          {sub.code}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
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
          onLoadIntoEditor={onSelectCode}
        />
      )}
    </div>
  );
};

export default SubmissionsTab;
