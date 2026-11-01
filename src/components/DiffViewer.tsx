'use client';

import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Columns,
  Rows,
  Eye,
  EyeOff,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { DiffResult } from '@/core/types';
import { computeDiff, normalizeOutput } from '@/core';

export interface DiffViewerProps {
  expected: string;
  actual: string;
  diff?: DiffResult | null;
  className?: string;
  defaultViewMode?: 'side-by-side' | 'stacked';
}

interface LineComparison {
  lineNumber: number;
  expectedText: string | null;
  actualText: string | null;
  isMismatch: boolean;
  isFirstMismatch: boolean;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  expected,
  actual,
  diff: externalDiff,
  className = '',
  defaultViewMode = 'side-by-side',
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'stacked'>(defaultViewMode);
  const [showWhitespace, setShowWhitespace] = useState(false);
  const [copiedExpected, setCopiedExpected] = useState(false);
  const [copiedActual, setCopiedActual] = useState(false);

  // Compute diff if not provided
  const effectiveDiff = useMemo(() => {
    if (externalDiff !== undefined) return externalDiff;
    return computeDiff(expected, actual);
  }, [externalDiff, expected, actual]);

  // Break lines down preserving exact content
  const comparisonLines = useMemo<LineComparison[]>(() => {
    const rawExpLines = expected.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const rawActLines = actual.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    // Trim trailing empty line if both ended with newline to avoid visual noise
    const expLines = [...rawExpLines];
    const actLines = [...rawActLines];
    if (expLines.length > 1 && expLines[expLines.length - 1] === '') expLines.pop();
    if (actLines.length > 1 && actLines[actLines.length - 1] === '') actLines.pop();

    const maxLines = Math.max(expLines.length, actLines.length, 1);
    const lines: LineComparison[] = [];

    const firstMismatchLine = effectiveDiff?.lineIndex;

    for (let i = 0; i < maxLines; i++) {
      const exp = i < expLines.length ? expLines[i] : null;
      const act = i < actLines.length ? actLines[i] : null;
      const lineNum = i + 1;

      const isMismatch = exp !== act;
      const isFirstMismatch = firstMismatchLine === lineNum;

      lines.push({
        lineNumber: lineNum,
        expectedText: exp,
        actualText: act,
        isMismatch,
        isFirstMismatch,
      });
    }

    return lines;
  }, [expected, actual, effectiveDiff]);

  const handleCopy = async (text: string, type: 'expected' | 'actual') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'expected') {
        setCopiedExpected(true);
        setTimeout(() => setCopiedExpected(false), 2000);
      } else {
        setCopiedActual(true);
        setTimeout(() => setCopiedActual(false), 2000);
      }
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      if (type === 'expected') {
        setCopiedExpected(true);
        setTimeout(() => setCopiedExpected(false), 2000);
      } else {
        setCopiedActual(true);
        setTimeout(() => setCopiedActual(false), 2000);
      }
    }
  };

  const formatText = (text: string | null) => {
    if (text === null) {
      return <span className="text-slate-600 italic select-none">&lt;EOF&gt;</span>;
    }
    if (text === '') {
      return (
        <span className="text-slate-600 italic select-none">
          {showWhitespace ? '↵ (empty line)' : ''}
        </span>
      );
    }
    if (!showWhitespace) {
      return text;
    }

    // Replace spaces and tabs with visible symbols
    return text.replace(/ /g, '·').replace(/\t/g, '→   ');
  };

  const isIdentical = !effectiveDiff && normalizeOutput(expected) === normalizeOutput(actual);

  return (
    <div
      className={`rounded-lg border border-slate-800 bg-slate-950 overflow-hidden flex flex-col text-slate-200 font-sans ${className}`}
    >
      {/* Top Banner & Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {isIdentical ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <span>Outputs match perfectly</span>
            </div>
          ) : effectiveDiff ? (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>
                First mismatch at line{' '}
                <strong className="text-rose-300 underline font-semibold">
                  {effectiveDiff.lineIndex}
                </strong>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Whitespace or line-ending divergence</span>
            </div>
          )}
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setShowWhitespace(!showWhitespace)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              showWhitespace
                ? 'bg-slate-700 text-cyan-300 font-medium'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
            }`}
            title="Toggle visible whitespace characters (· for space, → for tab)"
          >
            {showWhitespace ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Whitespace</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'side-by-side' ? 'stacked' : 'side-by-side')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
            title={`Switch to ${viewMode === 'side-by-side' ? 'Stacked' : 'Side-by-Side'} view`}
          >
            {viewMode === 'side-by-side' ? (
              <>
                <Rows className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Stacked</span>
              </>
            ) : (
              <>
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Side-by-Side</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Diff Inspector Content */}
      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 text-xs md:text-sm overflow-x-auto">
          {/* Column 1: Expected Output */}
          <div className="flex flex-col min-w-[280px]">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900/50 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Expected Output
              </span>
              <button
                type="button"
                onClick={() => handleCopy(expected, 'expected')}
                className="inline-flex items-center gap-1 text-[11px] font-normal text-slate-400 hover:text-slate-200 transition-colors"
                title="Copy expected output"
              >
                {copiedExpected ? (
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
            </div>

            <div className="font-mono p-2 overflow-x-auto flex-1 bg-slate-950/60">
              {comparisonLines.map((line) => (
                <div
                  key={`exp-${line.lineNumber}`}
                  className={`flex items-start px-2 py-0.5 rounded transition-colors ${
                    line.isMismatch
                      ? 'bg-rose-500/10 text-rose-200 border-l-2 border-rose-500 font-medium'
                      : 'hover:bg-slate-900/40 text-slate-300'
                  }`}
                >
                  <span className="w-8 shrink-0 text-right pr-3 select-none text-slate-600 font-mono text-xs">
                    {line.lineNumber}
                  </span>
                  <span className="whitespace-pre font-mono break-all flex-1">
                    {formatText(line.expectedText)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Actual Output */}
          <div className="flex flex-col min-w-[280px]">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900/50 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isIdentical ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
                Actual Output
              </span>
              <button
                type="button"
                onClick={() => handleCopy(actual, 'actual')}
                className="inline-flex items-center gap-1 text-[11px] font-normal text-slate-400 hover:text-slate-200 transition-colors"
                title="Copy actual output"
              >
                {copiedActual ? (
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
            </div>

            <div className="font-mono p-2 overflow-x-auto flex-1 bg-slate-950/60">
              {comparisonLines.map((line) => (
                <div
                  key={`act-${line.lineNumber}`}
                  className={`flex items-start px-2 py-0.5 rounded transition-colors ${
                    line.isMismatch
                      ? 'bg-rose-500/15 text-rose-200 border-l-2 border-rose-500 font-medium'
                      : 'hover:bg-slate-900/40 text-slate-300'
                  }`}
                >
                  <span className="w-8 shrink-0 text-right pr-3 select-none text-slate-600 font-mono text-xs">
                    {line.lineNumber}
                  </span>
                  <span className="whitespace-pre font-mono break-all flex-1">
                    {formatText(line.actualText)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Stacked View */
        <div className="divide-y divide-slate-800 text-xs md:text-sm">
          {/* Expected Output Block */}
          <div>
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900/50 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Expected Output
              </span>
              <button
                type="button"
                onClick={() => handleCopy(expected, 'expected')}
                className="inline-flex items-center gap-1 text-[11px] font-normal text-slate-400 hover:text-slate-200 transition-colors"
              >
                {copiedExpected ? (
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
            </div>
            <div className="font-mono p-2 overflow-x-auto bg-slate-950/60 max-h-56">
              {comparisonLines.map((line) => (
                <div
                  key={`stacked-exp-${line.lineNumber}`}
                  className={`flex items-start px-2 py-0.5 rounded ${
                    line.isMismatch
                      ? 'bg-rose-500/10 text-rose-200 border-l-2 border-rose-500 font-medium'
                      : 'hover:bg-slate-900/40 text-slate-300'
                  }`}
                >
                  <span className="w-8 shrink-0 text-right pr-3 select-none text-slate-600 font-mono text-xs">
                    {line.lineNumber}
                  </span>
                  <span className="whitespace-pre font-mono break-all flex-1">
                    {formatText(line.expectedText)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actual Output Block */}
          <div>
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900/50 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isIdentical ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
                Actual Output
              </span>
              <button
                type="button"
                onClick={() => handleCopy(actual, 'actual')}
                className="inline-flex items-center gap-1 text-[11px] font-normal text-slate-400 hover:text-slate-200 transition-colors"
              >
                {copiedActual ? (
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
            </div>
            <div className="font-mono p-2 overflow-x-auto bg-slate-950/60 max-h-56">
              {comparisonLines.map((line) => (
                <div
                  key={`stacked-act-${line.lineNumber}`}
                  className={`flex items-start px-2 py-0.5 rounded ${
                    line.isMismatch
                      ? 'bg-rose-500/15 text-rose-200 border-l-2 border-rose-500 font-medium'
                      : 'hover:bg-slate-900/40 text-slate-300'
                  }`}
                >
                  <span className="w-8 shrink-0 text-right pr-3 select-none text-slate-600 font-mono text-xs">
                    {line.lineNumber}
                  </span>
                  <span className="whitespace-pre font-mono break-all flex-1">
                    {formatText(line.actualText)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiffViewer;
