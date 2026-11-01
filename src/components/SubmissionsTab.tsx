'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { SubmissionRecord, LanguageId, VerdictStatus } from '@/core/types';
import { cn } from '@/lib/utils';

export interface SubmissionsTabProps {
  submissions: SubmissionRecord[];
  onSelectCode: (code: string, lang: LanguageId) => void;
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
        label: 'Time Limit Exceeded',
        code: 'TLE',
        className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        icon: Clock,
      };
    case 'MLE':
      return {
        label: 'Memory Limit Exceeded',
        code: 'MLE',
        className: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
        icon: HardDrive,
      };
    case 'CE':
      return {
        label: 'Compilation Error',
        code: 'CE',
        className: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        icon: AlertTriangle,
      };
    case 'RE':
      return {
        label: 'Runtime Error',
        code: 'RE',
        className: 'bg-red-500/15 text-red-400 border-red-500/30',
        icon: XCircle,
      };
    case 'SKIPPED':
      return {
        label: 'Passed (>100KB)',
        code: 'SKIPPED',
        className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        icon: CheckCircle2,
      };
    default:
      return {
        label: status,
        code: status,
        className: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
        icon: AlertTriangle,
      };
  }
}

export const SubmissionsTab: React.FC<SubmissionsTabProps> = ({
  submissions,
  onSelectCode,
  className,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

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

  if (!submissions || submissions.length === 0) {
    return (
      <div
        className={cn(
          'p-12 text-center rounded-lg border border-border-subtle bg-surface-1/40',
          className
        )}
      >
        <Inbox className="w-10 h-10 text-slate-500 mx-auto mb-3 opacity-60" />
        <h3 className="text-sm font-semibold text-slate-200">
          No submissions yet
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Submit your solution in the editor to record test results, execution
          runtime, memory metrics, and code revisions.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-border-subtle">
        <span>
          Showing <span className="font-semibold text-slate-200">{submissions.length}</span>{' '}
          {submissions.length === 1 ? 'submission' : 'submissions'}
        </span>
        <span className="text-[11px] text-slate-400">
          Sorted by newest first
        </span>
      </div>

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
              className="rounded-lg border border-border-subtle bg-surface-1/70 transition-all hover:border-border-muted overflow-hidden shadow-sm"
            >
              {/* Header Row */}
              <div className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                {/* Left: Status & Meta */}
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

                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-surface-2 text-slate-300 border border-border-subtle">
                    {langDisplay}
                  </span>

                  {sub.totalCount > 0 && (
                    <span className="text-xs font-mono text-slate-400">
                      {sub.passedCount}/{sub.totalCount} tests passed
                    </span>
                  )}
                </div>

                {/* Right: Metrics & Actions */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span
                      className="flex items-center gap-1"
                      title="Peak Execution Time"
                    >
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-200 font-semibold">
                        {sub.maxTimeMs} ms
                      </span>
                    </span>

                    <span
                      className="flex items-center gap-1"
                      title="Memory Consumption"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-200">{memoryMb} MB</span>
                    </span>

                    <span
                      className="flex items-center gap-1"
                      title="Character Count"
                    >
                      <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-200">{sub.charCount} ch.</span>
                    </span>
                  </div>

                  <span
                    className="text-xs text-slate-400 border-l border-border-subtle pl-3"
                    title={formatExactDate(sub.timestamp)}
                  >
                    {formatTimestamp(sub.timestamp)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 border-l border-border-subtle pl-2">
                    <button
                      onClick={() =>
                        handleLoadCode(sub.id, sub.code, sub.language)
                      }
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors border',
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
                      onClick={() =>
                        setExpandedId(isExpanded ? null : sub.id)
                      }
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-surface-2 transition-colors"
                      title={isExpanded ? 'Collapse code preview' : 'View code'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Collapsible Code Preview */}
              {isExpanded && (
                <div className="border-t border-border-subtle bg-surface-0/90 p-3">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border-subtle/60 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-3.5 h-3.5 text-sky-400" />
                      <span className="font-mono text-slate-300 text-[11px]">
                        {langDisplay} source ({sub.charCount} characters)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyCode(sub.id, sub.code)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white transition-colors"
                      >
                        {copiedId === sub.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() =>
                          handleLoadCode(sub.id, sub.code, sub.language)
                        }
                        className="text-[11px] text-sky-400 hover:text-sky-300 underline font-medium"
                      >
                        Restore into Editor
                      </button>
                    </div>
                  </div>

                  <pre className="font-mono text-xs text-slate-200 overflow-x-auto max-h-60 p-2.5 rounded bg-surface-1 border border-border-subtle select-text whitespace-pre leading-relaxed">
                    <code>{sub.code}</code>
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SubmissionsTab;
