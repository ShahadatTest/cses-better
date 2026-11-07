'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Code2,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Zap,
  FileCode2,
  Download,
  AlertCircle,
  Terminal,
} from 'lucide-react';
import { LanguageId } from '@/core/types';
import { getStoredCsesSessionCookie } from '@/core/cses-client';
import { cn } from '@/lib/utils';

export interface CsesCodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId?: string;
  solverName?: string;
  problemId?: string;
  problemTitle?: string;
  language?: string;
  score?: string;
  statusText?: string;
  scoreType?: 'time' | 'size' | 'queue';
  initialCode?: string;
  coverage?: 'available' | 'partial' | 'unavailable';
  onLoadIntoEditor?: (code: string, lang: LanguageId) => void;
}

function detectLanguageId(langStr?: string): LanguageId | null {
  if (!langStr) return null;
  const lower = langStr.toLowerCase();
  if (lower.includes('c++') || lower.includes('cpp')) return 'cpp';
  if (lower.includes('python') || lower.includes('pypy')) return 'python';
  if (lower.includes('java')) return 'java';
  if (lower.includes('rust')) return 'rust';
  if (lower.includes('go')) return 'go';
  if (lower.includes('javascript') || lower.includes('node')) return 'javascript';
  if (lower.includes('typescript')) return 'typescript';
  if (lower === 'c') return 'c';
  return null;
}

export function CsesCodeViewerModal({
  isOpen,
  onClose,
  submissionId,
  solverName = 'CSES Solver',
  problemId,
  problemTitle,
  language = 'C++',
  score,
  statusText: initialStatus,
  scoreType = 'time',
  initialCode,
  coverage,
  onLoadIntoEditor,
}: CsesCodeViewerModalProps) {
  const [code, setCode] = useState<string>(initialCode || '');
  const [resolvedLanguage, setResolvedLanguage] = useState<string>(language);
  const [statusText, setStatusText] = useState<string>(initialStatus || 'ACCEPTED');
  const [totalTime, setTotalTime] = useState<string | undefined>(score);
  const [totalMemory, setTotalMemory] = useState<string | undefined>();
  const [compilerOutput, setCompilerOutput] = useState<string | undefined>();
  const [failedTestSummary, setFailedTestSummary] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const controller = new AbortController();
    setCode(''); setError(null); setIsLoading(false); setResolvedLanguage(language);
    setStatusText(initialStatus || 'ACCEPTED'); setCopied(false);
    setTotalTime(score); setTotalMemory(undefined); setCompilerOutput(undefined); setFailedTestSummary(undefined);

    if (initialCode) {
      setCode(initialCode);
      return;
    }

    if (submissionId) {
      // Check if submission ID is a valid numeric CSES ID
      if (!/^\d+$/.test(submissionId)) {
        // Non-numeric ID (e.g. public queue submission where CSES keeps non-accepted code private to submitter)
        const verdictLabel = initialStatus || 'WRONG ANSWER';
        setStatusText(verdictLabel);
        setCode('');
        setError(`CSES source is private for this unlinked submission (${verdictLabel}).`);
        return;
      }

      setIsLoading(true);
      setError(null);
      const queryParam = problemId ? `?problemId=${encodeURIComponent(problemId)}` : '';
      const headers: Record<string, string> = {};
      const sessionCookie = getStoredCsesSessionCookie();
      if (sessionCookie) {
        headers['x-cses-session'] = sessionCookie;
      }

      setIsLoading(true);
      fetch(`/api/cses/result/${submissionId}${queryParam}`, { headers, signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error('Submission code not available');
          return res.json();
        })
        .then((data) => {
          if (!active) return;
          if (data.code) {
            setCode(data.code);
          } else {
            setCode(''); setError('CSES did not expose source code for this submission.');
          }
          if (data.language) setResolvedLanguage(data.language);
          if (data.rawStatusText && data.rawStatusText !== 'UNKNOWN') setStatusText(data.rawStatusText);
          if (data.totalTime) setTotalTime(data.totalTime);
          if (data.totalMemory) setTotalMemory(data.totalMemory);
          if (data.compilerOutput) setCompilerOutput(data.compilerOutput);
          if (Array.isArray(data.tests)) {
            const fail = data.tests.find((t: any) => t.verdict !== 'ACCEPTED');
            if (fail) {
              setFailedTestSummary(`Failed at Test #${fail.index}: ${fail.verdict} (${fail.time})`);
            }
          }
        })
        .catch((err) => {
          if (active && err?.name !== 'AbortError') setError(err?.message || 'Failed to fetch submission source code');
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    } else {
      setError('No verified CSES submission ID is available for this leaderboard entry.');
    }
    return () => { active = false; controller.abort(); };
  }, [isOpen, submissionId, initialCode, initialStatus, language, solverName, problemId, score]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleLoad = () => {
    if (!code || !onLoadIntoEditor) return;
    const lang = detectLanguageId(resolvedLanguage);
    if (!lang) return;
    onLoadIntoEditor(code, lang);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-zinc-100">
                  {solverName ? `${solverName}'s Solution` : 'CSES Solution Code'}
                </h3>
                {submissionId && (
                  <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                    #{submissionId}
                  </span>
                )}
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border',
                    statusText.toUpperCase().includes('ACCEPTED')
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : statusText.toUpperCase().includes('WRONG')
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : statusText.toUpperCase().includes('TIME')
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                  )}
                >
                  {statusText}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {problemTitle ? `${problemTitle} · ` : ''}
                {resolvedLanguage} {score ? `· ${score}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {submissionId && (
              <a
                href={`https://cses.fi/problemset/result/${submissionId}/`}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                title="View on CSES.fi"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Benchmarks Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-zinc-950/60 border-b border-zinc-800/80 text-xs text-zinc-400 shrink-0">
          <div className="flex items-center gap-4">
            {scoreType === 'time' && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
                <Zap className="w-3.5 h-3.5" />
                <span>Runtime: {totalTime || score || '0.00 s'}</span>
              </span>
            )}
            {scoreType === 'size' && (
              <span className="flex items-center gap-1.5 text-sky-400 font-mono">
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Size: {score || `${code.length} ch.`}</span>
              </span>
            )}
            {totalMemory && (
              <span className="text-zinc-400 font-mono">Memory: {totalMemory}</span>
            )}
            <span className="text-zinc-500 font-mono">Lang: {resolvedLanguage}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
            {onLoadIntoEditor && detectLanguageId(resolvedLanguage) && (
              <button
                onClick={handleLoad}
                className="flex items-center gap-1.5 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium shadow transition-colors"
                title="Replace editor code with this solution"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Load in Editor</span>
              </button>
            )}
          </div>
        </div>

        {/* Code Content Body */}
        <div className="flex-1 p-4 overflow-y-auto bg-zinc-950/80 font-mono text-xs">

          {failedTestSummary && (
            <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-medium">{failedTestSummary}</span>
            </div>
          )}

          {coverage === 'partial' && (
            <p className="mb-3 text-[11px] text-amber-300" role="status">
              CSES has more matching queue pages. This source was selected from the first page of results ordered by maximum time; the rest of the history was not loaded.
            </p>
          )}

          {compilerOutput && (
            <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <Terminal className="w-3.5 h-3.5" />
                <span>Compiler Diagnostics</span>
              </div>
              <pre className="p-2.5 rounded-lg bg-zinc-950/80 border border-amber-500/20 text-[11px] text-amber-200 overflow-x-auto whitespace-pre">
                {compilerOutput}
              </pre>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span>Fetching original source code from CSES...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">Code Retrieval Error</p>
                <p className="text-xs text-red-300 mt-0.5">{error}</p>
              </div>
            </div>
          ) : (
            <pre className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 select-all overflow-x-auto whitespace-pre leading-relaxed font-mono">
              {code}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
