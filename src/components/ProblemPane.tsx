'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Trophy,
  History,
  StickyNote,
  Clock,
  Cpu,
  CheckCircle2,
  CircleDot,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Terminal,
  Download,
} from 'lucide-react';
import { Problem, SubmissionRecord, LanguageId } from '@/core/types';
import { KaTeXRenderer } from './KaTeXRenderer';
import { LeaderboardTab } from './LeaderboardTab';
import { SubmissionsTab } from './SubmissionsTab';
import { NotesTab } from './NotesTab';
import { cn } from '@/lib/utils';

export type ProblemTab = 'statement' | 'leaderboard' | 'submissions' | 'notes';

export interface ProblemPaneProps {
  problem: Problem;
  submissions?: SubmissionRecord[];
  isSolved?: boolean;
  onSelectCode?: (code: string, lang: LanguageId) => void;
  userExecutionTimeMs?: number;
  userCharCount?: number;
  activeTab?: ProblemTab;
  onTabChange?: (tab: ProblemTab) => void;
  className?: string;
  onSelectUser?: (nick: string) => void;
}

/**
 * Strips duplicate constraints and example blocks from statementHtml
 * if dedicated structured sections are being displayed.
 */
function cleanStatementHtml(
  html: string,
  hasDedicatedConstraints: boolean,
  hasDedicatedSamples: boolean
): string {
  if (!html) return '';
  let result = html;

  if (hasDedicatedConstraints) {
    result = result.replace(
      /<h1\s+id=["']constraints["'][^>]*>[\s\S]*?(?:<\/ul>|(?=<h1|$))/gi,
      ''
    );
  }

  if (hasDedicatedSamples) {
    result = result.replace(
      /<h1\s+id=["']example[^"']*["'][^>]*>[\s\S]*$/gi,
      ''
    );
  }

  return result.trim();
}

export const ProblemPane: React.FC<ProblemPaneProps> = ({
  problem,
  submissions = [],
  isSolved = false,
  onSelectCode = () => {},
  userExecutionTimeMs,
  userCharCount,
  activeTab,
  onTabChange,
  className,
  onSelectUser,
}) => {
  const [internalTab, setInternalTab] = useState<ProblemTab>('statement');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentTab = activeTab ?? internalTab;

  const handleTabClick = (tab: ProblemTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  const handleCopyText = async (key: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setToastMessage(`Copied ${label} to clipboard`);
      setTimeout(() => {
        setCopiedKey(null);
        setToastMessage(null);
      }, 2000);
    } catch {
      // clipboard access error fallback
    }
  };

  const hasStats =
    problem.stats &&
    (problem.stats.solvedBy > 0 ||
      (problem.stats.fastest && problem.stats.fastest.length > 0));

  const hasConstraints = Boolean(
    problem.constraints && problem.constraints.length > 0
  );

  const sampleCases = (problem.testCases || []).filter(
    (tc) => tc.isSample !== false
  );
  const hasSamples = sampleCases.length > 0;

  const sanitizedStatement = cleanStatementHtml(
    problem.statementHtml,
    hasConstraints,
    hasSamples
  );

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-surface-1 border-r border-border-subtle overflow-hidden select-text',
        className
      )}
    >
      {/* 1. Top Navigation Tab Bar */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-surface-1/95 backdrop-blur-xs px-3 shrink-0 z-10">
        <div className="flex items-center gap-1 overflow-x-auto">
          {/* Statement Tab */}
          <button
            onClick={() => handleTabClick('statement')}
            className={cn(
              'flex items-center gap-2 px-3 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
              currentTab === 'statement'
                ? 'border-sky-400 text-sky-400 bg-surface-2/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-2/20'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Statement</span>
          </button>

          {/* Leaderboard & Stats Tab */}
          <button
            onClick={() => handleTabClick('leaderboard')}
            className={cn(
              'flex items-center gap-2 px-3 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
              currentTab === 'leaderboard'
                ? 'border-sky-400 text-sky-400 bg-surface-2/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-2/20'
            )}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Leaderboard &amp; Stats</span>
            {hasStats && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                title="CSES official stats available"
              />
            )}
          </button>

          {/* Submissions Tab */}
          <button
            onClick={() => handleTabClick('submissions')}
            className={cn(
              'flex items-center gap-2 px-3 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
              currentTab === 'submissions'
                ? 'border-sky-400 text-sky-400 bg-surface-2/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-2/20'
            )}
          >
            <History className="w-3.5 h-3.5" />
            <span>Submissions</span>
            {submissions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface-3 text-slate-200">
                {submissions.length}
              </span>
            )}
          </button>

          {/* Notes Tab */}
          <button
            onClick={() => handleTabClick('notes')}
            className={cn(
              'flex items-center gap-2 px-3 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
              currentTab === 'notes'
                ? 'border-sky-400 text-sky-400 bg-surface-2/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-surface-2/20'
            )}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>Notes</span>
          </button>
        </div>

        {/* Submit on Official CSES.fi Link */}
        <a
          href={`https://cses.fi/problemset/task/${problem.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-300 hover:text-sky-300 transition-colors px-2.5 py-1 rounded-md bg-surface-2/60 hover:bg-surface-2 border border-border-subtle shadow-xs"
          title="Open official task page on CSES.fi to upload and submit your downloaded solution"
        >
          <span>Submit on CSES.fi</span>
          <ExternalLink className="w-3 h-3 text-sky-400" />
        </a>
      </div>

      {/* 2. Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto p-5 relative">
        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-5 left-8 z-50 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-2 text-slate-200 border border-emerald-500/40 shadow-xl text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* TAB 1: STATEMENT */}
        {currentTab === 'statement' && (
          <div className="space-y-6 max-w-4xl">
            {/* Header: Category & Title & Badges */}
            <div className="space-y-3 pb-4 border-b border-border-subtle">
              {/* Category Breadcrumb */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-semibold text-sky-400">CSES Problemset</span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-300 font-medium truncate">
                  {problem.category}
                </span>
              </div>

              {/* Problem Title & ID */}
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                  {problem.title}
                </h1>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-surface-2 text-slate-300 border border-border-subtle">
                  #{problem.id}
                </span>
              </div>

              {/* Metadata Badges */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {/* Time Limit */}
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-surface-2/60 text-slate-300 border border-border-subtle"
                  title="CPU Time Limit"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Time limit:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {problem.timeLimit}
                  </span>
                </div>

                {/* Memory Limit */}
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-surface-2/60 text-slate-300 border border-border-subtle"
                  title="Memory Limit"
                >
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  <span>Memory limit:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {problem.memoryLimit}
                  </span>
                </div>

                {/* Solved Status */}
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border',
                    isSolved
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800/40 text-slate-400 border-border-subtle'
                  )}
                >
                  {isSolved ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Solved</span>
                    </>
                  ) : (
                    <>
                      <CircleDot className="w-3.5 h-3.5 text-slate-400" />
                      <span>Unsolved</span>
                    </>
                  )}
                </div>

                {/* Download Official Test Cases Zip */}
                <a
                  href={`/api/tests/${problem.id}`}
                  download={`cses_${problem.id}_tests.zip`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 border border-sky-800/50 transition-colors shadow-xs"
                  title="Download all official CSES test cases (.zip archive)"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Download Tests (.zip)</span>
                </a>
              </div>
            </div>

            {/* Statement Body (Rendered with KaTeX) */}
            <div className="prose prose-invert max-w-none">
              <KaTeXRenderer content={sanitizedStatement} />
            </div>

            {/* Constraints Section (Rendered with KaTeX math) */}
            {hasConstraints && (
              <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-4 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-border-subtle pb-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Constraints</span>
                </div>

                <ul className="space-y-2 pt-1">
                  {problem.constraints?.map((constraint, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2.5 text-xs text-slate-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                      <KaTeXRenderer content={constraint} inline />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sample Test Cases with Copy Input / Output */}
            {hasSamples && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-border-subtle pb-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  <span>
                    Sample Test Cases ({sampleCases.length})
                  </span>
                </div>

                <div className="space-y-4">
                  {sampleCases.map((tc, idx) => {
                    const inputKey = `${tc.id}-input`;
                    const outputKey = `${tc.id}-output`;
                    const isInputCopied = copiedKey === inputKey;
                    const isOutputCopied = copiedKey === outputKey;

                    return (
                      <div
                        key={tc.id || idx}
                        className="rounded-lg border border-border-subtle bg-surface-1/70 overflow-hidden shadow-sm"
                      >
                        {/* Sample header */}
                        <div className="px-3.5 py-2 bg-surface-2/40 border-b border-border-subtle flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold text-slate-200">
                            Example {idx + 1}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            ID: {tc.id}
                          </span>
                        </div>

                        {/* Input & Output Grids */}
                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
                          {/* Input Block */}
                          <div className="p-3.5 flex flex-col space-y-2 bg-surface-0/40">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                                Input
                              </span>
                              <button
                                onClick={() =>
                                  handleCopyText(
                                    inputKey,
                                    tc.input,
                                    `Example ${idx + 1} Input`
                                  )
                                }
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors border',
                                  isInputCopied
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white border-border-subtle'
                                )}
                              >
                                {isInputCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-400" />
                                    <span>Copy Input</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <pre className="p-3 rounded-md bg-surface-0 border border-border-subtle font-mono text-xs text-slate-200 select-all overflow-x-auto whitespace-pre leading-relaxed min-h-[50px]">
                              {tc.input}
                            </pre>
                          </div>

                          {/* Expected Output Block */}
                          <div className="p-3.5 flex flex-col space-y-2 bg-surface-0/40">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                                Expected Output
                              </span>
                              <button
                                onClick={() =>
                                  handleCopyText(
                                    outputKey,
                                    tc.expectedOutput,
                                    `Example ${idx + 1} Output`
                                  )
                                }
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors border',
                                  isOutputCopied
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white border-border-subtle'
                                )}
                              >
                                {isOutputCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-400" />
                                    <span>Copy Output</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <pre className="p-3 rounded-md bg-surface-0 border border-border-subtle font-mono text-xs text-slate-200 select-all overflow-x-auto whitespace-pre leading-relaxed min-h-[50px]">
                              {tc.expectedOutput}
                            </pre>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LEADERBOARD & STATS */}
        {currentTab === 'leaderboard' && (
          <LeaderboardTab
            stats={problem.stats}
            userExecutionTimeMs={userExecutionTimeMs}
            userCharCount={userCharCount}
            isSolved={isSolved}
            onSelectUser={onSelectUser}
          />
        )}

        {/* TAB 3: SUBMISSIONS */}
        {currentTab === 'submissions' && (
          <SubmissionsTab
            submissions={submissions}
            onSelectCode={onSelectCode}
          />
        )}

        {/* TAB 4: NOTES */}
        {currentTab === 'notes' && <NotesTab problemId={problem.id} />}
      </div>
    </div>
  );
};

export default ProblemPane;
