'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Plus,
  X,
  Play,
  Copy,
  Check,
  Clock,
  HardDrive,
  Terminal,
  CheckCircle2,
  AlertOctagon,
  AlertCircle,
  Sparkles,
  LayoutGrid,
  FileCode2,
  ChevronRight,
  Info,
  Download,
  Loader2,
} from 'lucide-react';
import { TestCase, TestResult, VerdictStatus } from '@/core/types';
import VerdictBadge from './VerdictBadge';
import DiffViewer from './DiffViewer';

export interface TestBenchProps {
  testCases: TestCase[];
  results: Record<string, TestResult>;
  activeTestCaseId: string;
  onSelectTestCase: (id: string) => void;
  onAddCustomTestCase: (input: string, expectedOutput: string) => void;
  onDeleteCustomTestCase: (id: string) => void;
  onLoadOfficialTests?: () => void;
  isLoadingOfficialTests?: boolean;
  problemId?: string;
  isRunning?: boolean;
  overallStatus?: VerdictStatus;
  submissionResults?: TestResult[] | null;
  className?: string;
}

export const TestBench: React.FC<TestBenchProps> = ({
  testCases,
  results,
  activeTestCaseId,
  onSelectTestCase,
  onAddCustomTestCase,
  onDeleteCustomTestCase,
  onLoadOfficialTests,
  isLoadingOfficialTests = false,
  problemId,
  isRunning = false,
  overallStatus,
  submissionResults,
  className = '',
}) => {
  // Navigation tabs: 'input' | 'output' (defaults to 'output' if active test case already has a result)
  const [panelTab, setPanelTab] = useState<'input' | 'output'>(() => {
    const initialResult = results[activeTestCaseId];
    return initialResult && initialResult.status !== 'IDLE' ? 'output' : 'input';
  });

  // Top view mode: 'cases' (individual test cases) | 'submission' (matrix view)
  const [viewMode, setViewMode] = useState<'cases' | 'submission'>(() => {
    return submissionResults && submissionResults.length > 0 ? 'submission' : 'cases';
  });

  // Custom test case creation modal/form state
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [customExpected, setCustomExpected] = useState('');

  // Editable input for active custom test case
  const [customInputDrafts, setCustomInputDrafts] = useState<Record<string, string>>({});

  // Copy feedback state
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedExpected, setCopiedExpected] = useState(false);
  const [copiedStderr, setCopiedStderr] = useState(false);
  const [copiedActual, setCopiedActual] = useState(false);

  // Large input safety state for Input tab
  const [showFullInput, setShowFullInput] = useState(false);

  // Reset showFullInput when active test case changes
  useEffect(() => {
    setShowFullInput(false);
  }, [activeTestCaseId]);

  // Submission statistics and progress calculations
  const { passedCount, skippedCount, completedCount, isEvaluating, allPassed } = useMemo(() => {
    if (!submissionResults || submissionResults.length === 0) {
      return {
        passedCount: 0,
        skippedCount: 0,
        completedCount: 0,
        isEvaluating: isRunning || overallStatus === 'RUNNING',
        allPassed: false,
      };
    }
    const passed = submissionResults.filter((r) => r.status === 'AC' || r.status === 'SKIPPED').length;
    const skipped = submissionResults.filter((r) => r.status === 'SKIPPED').length;
    const completed = submissionResults.filter((r) => r.status !== 'IDLE' && r.status !== 'RUNNING').length;
    const evaluating = isRunning || overallStatus === 'RUNNING';
    const allPass =
      submissionResults.length > 0 &&
      submissionResults.every((r) => r.status === 'AC' || r.status === 'SKIPPED');
    return {
      passedCount: passed,
      skippedCount: skipped,
      completedCount: completed,
      isEvaluating: evaluating,
      allPassed: allPass,
    };
  }, [submissionResults, isRunning, overallStatus]);

  // Confetti triggering tracking
  const lastConfettiTriggerRef = useRef<string | null>(null);

  // Switch view mode when submissionResults change
  useEffect(() => {
    if (submissionResults && submissionResults.length > 0) {
      setViewMode('submission');
    }
  }, [submissionResults]);

  // Check for all-AC or SKIPPED in submissionResults and trigger confetti
  useEffect(() => {
    if (submissionResults && submissionResults.length > 0) {
      const allPassedSuccess = submissionResults.every(
        (r) => r.status === 'AC' || r.status === 'SKIPPED'
      );
      if (allPassedSuccess) {
        // Construct a signature to prevent duplicate triggers
        const sig = submissionResults.map((r) => r.testCaseId + r.status).join(':');
        if (lastConfettiTriggerRef.current !== sig) {
          lastConfettiTriggerRef.current = sig;
          if (typeof window !== 'undefined') {
            try {
              confetti({
                particleCount: 120,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#10b981', '#38bdf8', '#a855f7', '#f59e0b', '#ec4899'],
              });
            } catch {
              // Ignore canvas errors
            }
          }
        }
      }
    }
  }, [submissionResults]);

  // Automatically switch to 'output' tab when a result arrives for the active test case
  const activeResult = results[activeTestCaseId];
  useEffect(() => {
    if (activeResult && activeResult.status !== 'IDLE') {
      setPanelTab('output');
    }
  }, [activeResult?.status, activeTestCaseId]);

  // Determine active test case
  const activeTestCase = useMemo(() => {
    return (
      testCases.find((tc) => tc.id === activeTestCaseId) ||
      testCases[0] || {
        id: 'default',
        input: '',
        expectedOutput: '',
        isSample: true,
      }
    );
  }, [testCases, activeTestCaseId]);

  // Label helper for test case tabs
  const getTabInfo = (tc: TestCase, index: number) => {
    const isCustom = tc.isSample === false || tc.id.startsWith('custom');
    if (isCustom) {
      const customIndex =
        testCases
          .slice(0, index + 1)
          .filter((t) => t.isSample === false || t.id.startsWith('custom')).length;
      return {
        label: `Custom ${customIndex}`,
        isCustom: true,
      };
    }
    const sampleIndex =
      testCases
        .slice(0, index + 1)
        .filter((t) => t.isSample !== false && !t.id.startsWith('custom')).length;
    return {
      label: `Sample ${sampleIndex}`,
      isCustom: false,
    };
  };

  // Helper for status indicator dot
  const getStatusDot = (tcId: string) => {
    if (isRunning && activeTestCaseId === tcId) {
      return 'bg-cyan-400 animate-pulse ring-2 ring-cyan-400/40';
    }
    const res = results[tcId];
    if (!res || res.status === 'IDLE') {
      return 'bg-slate-600';
    }
    if (res.status === 'RUNNING') {
      return 'bg-cyan-400 animate-pulse ring-2 ring-cyan-400/40';
    }
    if (res.status === 'AC') {
      return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]';
    }
    if (res.status === 'SKIPPED') {
      return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]';
    }
    // WA, TLE, RE, CE, MLE
    return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]';
  };

  // Format memory
  const formatMemory = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0.00 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  // Derive exit code
  const getExitCode = (res?: TestResult) => {
    if (!res) return '0';
    if ((res as unknown as { exitCode?: number }).exitCode !== undefined) {
      return String((res as unknown as { exitCode?: number }).exitCode);
    }
    if (res.status === 'AC' || res.status === 'WA') return '0';
    if (res.status === 'TLE') return '124 (SIGXCPU)';
    if (res.status === 'MLE') return '137 (SIGKILL)';
    if (res.status === 'CE') return '1 (CE)';
    if (res.status === 'RE') return '1 (RE)';
    return '0';
  };

  const handleCopy = async (text: string, setter: (val: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setter(true);
      setTimeout(() => setter(false), 2000);
    }
  };

  const handleAddCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    onAddCustomTestCase(customInput, customExpected);
    setCustomInput('');
    setCustomExpected('');
    setIsAddingCustom(false);
  };

  const currentActiveInput =
    customInputDrafts[activeTestCase.id] !== undefined
      ? customInputDrafts[activeTestCase.id]
      : activeTestCase.input;

  const isCurrentCustom =
    activeTestCase.isSample === false || activeTestCase.id.startsWith('custom');

  return (
    <div
      className={`flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl font-sans text-slate-200 ${className}`}
    >
      {/* Top Header / View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Test Bench
          </span>
          {overallStatus && overallStatus !== 'IDLE' && (
            <VerdictBadge status={overallStatus} size="sm" />
          )}
        </div>

        {submissionResults && submissionResults.length > 0 && (
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('cases')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'cases'
                  ? 'bg-slate-700 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Test Cases ({testCases.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('submission')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'submission'
                  ? 'bg-slate-700 text-cyan-300 font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>
                Submission Matrix ({passedCount}/{submissionResults.length})
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Main View Mode: Submission Results Matrix */}
      {viewMode === 'submission' && submissionResults && submissionResults.length > 0 ? (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 bg-slate-950">
          {/* Summary Card */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <VerdictBadge
                  status={
                    isEvaluating
                      ? 'RUNNING'
                      : overallStatus && overallStatus !== 'RUNNING'
                      ? overallStatus
                      : allPassed
                      ? 'AC'
                      : submissionResults.find((r) => r.status !== 'AC' && r.status !== 'SKIPPED')
                          ?.status ?? 'WA'
                  }
                  size="lg"
                />
                <div>
                  <h4 className="text-sm font-semibold text-white">Submission Test Matrix</h4>
                  <p className="text-xs text-slate-400">
                    {isEvaluating
                      ? `Running tests: ${completedCount} of ${submissionResults.length} completed (${passedCount} passed)...`
                      : `${passedCount} of ${submissionResults.length} test cases passed${
                          skippedCount > 0 ? ` (${skippedCount} bypassed >100KB)` : ''
                        }`}
                  </p>
                </div>
              </div>

              {isEvaluating ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/40 text-cyan-300 text-xs font-medium animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>
                    Running tests: {completedCount} of {submissionResults.length} completed (
                    {passedCount} passed)...
                  </span>
                </div>
              ) : allPassed ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>
                    All Tests Passed! 🎉 ({passedCount} of {submissionResults.length} passed
                    {skippedCount > 0 ? ` • ${skippedCount} bypassed >100KB` : ''})
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  <span>{submissionResults.length - passedCount} Failed</span>
                </div>
              )}
            </div>

            {/* Live Progress Bar when evaluating */}
            {isEvaluating && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
                    <span>
                      Running tests: {completedCount} of {submissionResults.length} completed (
                      {passedCount} passed)...
                    </span>
                  </span>
                  <span className="font-semibold text-cyan-200">
                    {Math.round((completedCount / submissionResults.length) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/60">
                  <div
                    className="bg-cyan-500 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                    style={{
                      width: `${Math.round((completedCount / submissionResults.length) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Test Grid Matrix */}
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Test Case Results
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {submissionResults.map((res, idx) => {
                const isRunningStatus = res.status === 'RUNNING';
                const isIdleStatus = res.status === 'IDLE';
                const isSkippedStatus = res.status === 'SKIPPED';
                const isAcStatus = res.status === 'AC';
                // failing: WA, TLE, RE, CE, MLE

                let containerClasses =
                  'bg-rose-500/5 border-rose-500/25 hover:border-rose-500/50';
                if (isRunningStatus) {
                  containerClasses =
                    'bg-cyan-500/10 border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.3)] animate-pulse';
                } else if (isIdleStatus) {
                  containerClasses = 'bg-slate-900/30 border-slate-800 text-slate-500';
                } else if (isSkippedStatus) {
                  containerClasses =
                    'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60';
                } else if (isAcStatus) {
                  containerClasses =
                    'bg-emerald-500/5 border-emerald-500/25 hover:border-emerald-500/50';
                }

                return (
                  <button
                    key={res.testCaseId || idx}
                    type="button"
                    onClick={() => {
                      onSelectTestCase(res.testCaseId);
                      setViewMode('cases');
                      setPanelTab('output');
                    }}
                    className={`flex flex-col p-2.5 rounded-lg border text-left transition-all hover:scale-[1.02] ${containerClasses}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-medium ${
                          isIdleStatus ? 'text-slate-500' : 'text-slate-300'
                        }`}
                      >
                        Test #{idx + 1}
                      </span>
                      {isRunningStatus ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          <span>Running</span>
                        </span>
                      ) : isIdleStatus ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700/60">
                          Queued
                        </span>
                      ) : isSkippedStatus ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Passed (&gt;100KB)
                        </span>
                      ) : (
                        <VerdictBadge status={res.status} size="sm" showIcon={false} />
                      )}
                    </div>
                    <div className="text-[11px] font-mono mt-auto">
                      {isRunningStatus ? (
                        <span className="text-cyan-300">Executing...</span>
                      ) : isIdleStatus ? (
                        <span className="text-slate-500">Waiting</span>
                      ) : isSkippedStatus ? (
                        <span className="text-amber-300/80">0 ms • Bypassed</span>
                      ) : (
                        <div className="text-slate-400 flex items-center justify-between w-full">
                          <span>{res.executionTimeMs} ms</span>
                          <span>{formatMemory(res.memoryBytes)}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Regular Test Cases View Mode */
        <div className="flex flex-col flex-1 min-h-0">
          {/* Test Case Tabs Bar */}
          <div className="flex items-center border-b border-slate-800 bg-slate-900/60 px-3 py-1.5 gap-1.5 overflow-x-auto select-none">
            {testCases.map((tc, index) => {
              const { label, isCustom } = getTabInfo(tc, index);
              const isActive = tc.id === activeTestCaseId;
              const dotClass = getStatusDot(tc.id);

              return (
                <button
                  key={tc.id}
                  type="button"
                  onClick={() => onSelectTestCase(tc.id)}
                  className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                  <span>{label}</span>

                  {isCustom && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCustomTestCase(tc.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          onDeleteCustomTestCase(tc.id);
                        }
                      }}
                      className="ml-0.5 p-0.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete custom test case"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}

            {/* Add Custom Test Case Button */}
            <button
              type="button"
              onClick={() => setIsAddingCustom(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-colors shrink-0 border border-dashed border-slate-700/80 hover:border-cyan-500/50"
              title="Add custom test case"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom</span>
            </button>

            {/* Load Official Test Suite Button */}
            {onLoadOfficialTests && (
              <button
                type="button"
                onClick={onLoadOfficialTests}
                disabled={isLoadingOfficialTests}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-950/40 transition-colors shrink-0 border border-sky-800/60 hover:border-sky-600 disabled:opacity-50"
                title="Load full official CSES test suite into the workbench"
              >
                {isLoadingOfficialTests ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span>Load Official Tests</span>
              </button>
            )}

            {/* Direct Download Zip Link */}
            {problemId && (
              <a
                href={`/api/tests/${problemId}`}
                download={`cses_${problemId}_tests.zip`}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors shrink-0 border border-slate-700/80 hover:border-slate-500"
                title="Download official test cases zip archive"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Download .zip</span>
              </a>
            )}
          </div>

          {/* Add Custom Test Case Inline Modal / Form */}
          {isAddingCustom && (
            <div className="border-b border-slate-800 bg-slate-900/90 p-4 animate-in fade-in duration-200">
              <form onSubmit={handleAddCustomSubmit} className="space-y-3 max-w-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    New Custom Test Case
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustom(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Input (stdin) <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Enter test input data..."
                      rows={3}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Expected Output
                    </label>
                    <textarea
                      value={customExpected}
                      onChange={(e) => setCustomExpected(e.target.value)}
                      placeholder="Enter expected stdout (optional)..."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingCustom(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm"
                  >
                    Add Test Case
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Performance Bar (Visible when result exists) */}
          {activeResult && activeResult.status !== 'IDLE' && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-3">
                <VerdictBadge status={activeResult.status} size="sm" />
                <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px] md:text-xs">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Time:</span>
                    <strong className="text-slate-200 font-medium">
                      {activeResult.executionTimeMs} ms
                    </strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                    <span>Memory:</span>
                    <strong className="text-slate-200 font-medium">
                      {formatMemory(activeResult.memoryBytes)}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Exit Code:</span>
                    <strong className="text-slate-200 font-medium">
                      {getExitCode(activeResult)}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Content Sub-Tabs Navigation */}
          <div className="flex items-center border-b border-slate-800 bg-slate-900/40 px-4">
            <button
              type="button"
              onClick={() => setPanelTab('input')}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                panelTab === 'input'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Test Case Input
            </button>
            <button
              type="button"
              onClick={() => setPanelTab('output')}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                panelTab === 'output'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Output & Diff</span>
              {activeResult && activeResult.status !== 'IDLE' && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeResult.status === 'AC'
                      ? 'bg-emerald-400'
                      : activeResult.status === 'SKIPPED'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
              )}
            </button>
          </div>

          {/* Panel Tab 1: Test Case Input */}
          {panelTab === 'input' && (
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {/* Input Box */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    Input (stdin)
                    {isCurrentCustom && (
                      <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20">
                        Editable
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(currentActiveInput, setCopiedInput)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                  >
                    {copiedInput ? (
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

                {/* Large Input Warning & Toggle Banner */}
                {currentActiveInput.length > 8000 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs">
                    <span className="text-amber-300 font-medium">
                      ⚠️ Large Input Data ({(currentActiveInput.length / 1024).toFixed(1)} KB).{' '}
                      {!showFullInput
                        ? 'Previewing first 4,000 chars to ensure smooth browser performance.'
                        : 'Showing full input dataset.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFullInput((prev) => !prev)}
                      className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium text-[11px] border border-amber-500/40 transition-colors"
                    >
                      {showFullInput ? 'Collapse' : 'Show Full Input'}
                    </button>
                  </div>
                )}

                {isCurrentCustom ? (
                  <textarea
                    value={
                      currentActiveInput.length > 8000 && !showFullInput
                        ? currentActiveInput.slice(0, 4000)
                        : currentActiveInput
                    }
                    onChange={(e) =>
                      setCustomInputDrafts({
                        ...customInputDrafts,
                        [activeTestCase.id]: e.target.value,
                      })
                    }
                    rows={4}
                    className="w-full bg-slate-950 p-3 font-mono text-xs text-slate-200 focus:outline-none resize-y"
                    placeholder="Enter custom input..."
                  />
                ) : (
                  <pre className="p-3 font-mono text-xs text-slate-200 bg-slate-950 overflow-x-auto whitespace-pre">
                    {currentActiveInput.length > 8000 && !showFullInput
                      ? currentActiveInput.slice(0, 4000) +
                        '\n\n... [truncated preview — click "Show Full Input" above to expand]'
                      : activeTestCase.input || <span className="text-slate-600">(empty)</span>}
                  </pre>
                )}
              </div>

              {/* Expected Output Box */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
                  <span className="font-semibold text-slate-300">Expected Output</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(activeTestCase.expectedOutput, setCopiedExpected)
                    }
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
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
                <pre className="p-3 font-mono text-xs text-slate-200 bg-slate-950 overflow-x-auto whitespace-pre">
                  {activeTestCase.expectedOutput || (
                    <span className="text-slate-600">(none specified)</span>
                  )}
                </pre>
              </div>
            </div>
          )}

          {/* Panel Tab 2: Output & Diff */}
          {panelTab === 'output' && (
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {isRunning ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-cyan-300">
                    Executing code in sandbox...
                  </p>
                  <p className="text-xs text-slate-500">
                    Compiling and evaluating against test case
                  </p>
                </div>
              ) : !activeResult || activeResult.status === 'IDLE' ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 text-slate-500">
                  <Play className="w-8 h-8 text-slate-600" />
                  <p className="text-sm font-medium text-slate-400">
                    Test case has not been executed yet
                  </p>
                  <p className="text-xs text-slate-600">
                    Click &quot;Run&quot; to test your solution against this input.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Compilation Error or Runtime Error: Stderr Box */}
                  {(activeResult.status === 'CE' ||
                    activeResult.status === 'RE' ||
                    activeResult.stderr) && (
                    <div className="rounded-lg border border-rose-500/30 bg-slate-950 overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between px-3 py-2 bg-rose-500/10 border-b border-rose-500/20 text-xs font-semibold text-rose-300">
                        <span className="flex items-center gap-1.5">
                          <AlertOctagon className="w-4 h-4 text-rose-400" />
                          {activeResult.status === 'CE'
                            ? 'Compilation Diagnostic (stderr)'
                            : 'Runtime Error / Diagnostic (stderr)'}
                        </span>
                        {activeResult.stderr && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(activeResult.stderr || '', setCopiedStderr)
                            }
                            className="flex items-center gap-1 text-[11px] font-normal text-rose-300 hover:text-white transition-colors"
                          >
                            {copiedStderr ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Error</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="p-3 max-h-60 overflow-y-auto overflow-x-auto bg-slate-950">
                        <pre className="font-mono text-xs text-rose-300/90 whitespace-pre-wrap select-text leading-relaxed">
                          {activeResult.stderr ||
                            (activeResult.status === 'CE'
                              ? 'Compilation failed without diagnostic output.'
                              : 'Process exited with non-zero status.')}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Wrong Answer (WA): Render DiffViewer */}
                  {activeResult.status === 'WA' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-400">
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span>Diff Inspector</span>
                      </div>
                      <DiffViewer
                        expected={activeResult.expectedOutput || activeTestCase.expectedOutput}
                        actual={activeResult.actualOutput}
                        diff={activeResult.diff}
                      />
                    </div>
                  )}

                  {/* Bypassed / Skipped (>100KB) Informational Card */}
                  {activeResult.status === 'SKIPPED' && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
                      <div className="flex items-start gap-3 text-amber-400">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-amber-300">
                            Input Exceeds Compiler Sandbox Limit (100 KB) — Marked as Done / Passed
                          </h4>
                          <p className="text-xs text-amber-300/80 leading-relaxed">
                            OnlineCompiler.io has a 100 KB payload limit, and this test input is{' '}
                            <span className="font-mono font-medium text-amber-200">
                              {(activeTestCase.input.length / 1024).toFixed(1)} KB
                            </span>
                            .
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-2.5">
                        <p className="leading-relaxed">
                          This test was automatically marked as done/passed so the rest of your test cases can be graded without blocking your submission.
                        </p>
                        <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5">
                          <span className="text-[11px] text-slate-400">Action guidance:</span>
                          {problemId ? (
                            <a
                              href={`/api/tests/${problemId}`}
                              download={`cses_${problemId}_tests.zip`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download .zip for local offline testing</span>
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-300/90 font-medium">
                              <Download className="w-3.5 h-3.5" />
                              <span>Download .zip for local offline testing</span>
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            or use &quot;Download File&quot; in the editor toolbar to submit manually on{' '}
                            {problemId ? (
                              <a
                                href={`https://cses.fi/problemset/task/${problemId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:underline font-medium"
                              >
                                cses.fi
                              </a>
                            ) : (
                              <span className="text-slate-300 font-medium">cses.fi</span>
                            )}
                            .
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Accepted (AC): Clean Success Card */}
                  {activeResult.status === 'AC' && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                      <div className="flex items-center gap-2.5 text-emerald-400">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-emerald-300">
                            Accepted! Output Matched Expected
                          </h4>
                          <p className="text-xs text-emerald-400/80">
                            Output passed all verification rules and formatting checks.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs font-medium text-slate-400">
                          <span>Execution Output</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(activeResult.actualOutput, setCopiedActual)
                            }
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
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
                        <pre className="p-3 font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre">
                          {activeResult.actualOutput || (
                            <span className="text-slate-600">(empty output)</span>
                          )}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Time Limit Exceeded (TLE) Card */}
                  {activeResult.status === 'TLE' && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                      <div className="flex items-center gap-2.5 text-amber-400">
                        <Clock className="w-5 h-5 shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-amber-300">
                            Time Limit Exceeded
                          </h4>
                          <p className="text-xs text-amber-400/80">
                            Execution took longer than the allocated limit. Check for infinite loops
                            or suboptimal algorithm complexity.
                          </p>
                        </div>
                      </div>
                      {activeResult.actualOutput && (
                        <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
                          <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs font-medium text-slate-400">
                            Partial Output Captured Before Timeout
                          </div>
                          <pre className="p-3 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre">
                            {activeResult.actualOutput}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Memory Limit Exceeded (MLE) Card */}
                  {activeResult.status === 'MLE' && (
                    <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
                      <div className="flex items-center gap-2.5 text-orange-400">
                        <HardDrive className="w-5 h-5 shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-orange-300">
                            Memory Limit Exceeded
                          </h4>
                          <p className="text-xs text-orange-400/80">
                            Process exceeded memory boundaries or was terminated by OOM killer.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestBench;
