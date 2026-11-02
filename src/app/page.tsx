'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import problemsData from '../data/problems.json';
import { categories } from '../data/categories';
import {
  Problem,
  LanguageId,
  TestCase,
  TestResult,
  VerdictStatus,
  SubmissionRecord,
  AppSettings,
  DEFAULT_APP_SETTINGS,
  isLargeInput,
  UserProfile,
  ProblemStats,
} from '../core/types';
import {
  getDraft,
  saveDraft,
  getSubmissions,
  saveSubmission,
  getSolvedProblems,
  saveSolvedProblem,
  getSettings,
  saveSettings,
} from '../core/storage';
import {
  getSupabase,
  mapSupabaseUser,
  fetchUserDataFromCloud,
  syncUserDataToCloud,
  syncAllLocalProgressToCloud,
} from '../core/supabase';
import { getLanguageTemplate } from '../core/templates';
import { executeCode } from '../core/compiler';
import { evaluateTestCase, computeDiff, summarizeTestResults } from '../core/judge';

import { SplitPane } from '../components/SplitPane';
import { Header } from '../components/Header';
import { CommandPalette } from '../components/CommandPalette';
import { SettingsModal } from '../components/SettingsModal';
import { ProblemPane } from '../components/ProblemPane';
import { EditorWorkbench } from '../components/editor/EditorWorkbench';
import { TestBench } from '../components/TestBench';
import { AuthModal } from '../components/AuthModal';
import { CsesSubmitModal } from '../components/CsesSubmitModal';
import { CsesUserProfileModal } from '../components/CsesUserProfileModal';
import { ArchiveExplorerModal } from '../components/ArchiveExplorerModal';

const allProblems = problemsData as Problem[];

export default function CSESBetterApp() {
  // Navigation & Problem Selection State
  const [currentProblemId, setCurrentProblemId] = useState<string>('1068');
  const [activeLanguage, setActiveLanguage] = useState<LanguageId>('cpp');
  const [code, setCode] = useState<string>('');
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Public User & Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isCsesSubmitModalOpen, setIsCsesSubmitModalOpen] = useState<boolean>(false);
  const [isCsesUserModalOpen, setIsCsesUserModalOpen] = useState<boolean>(false);
  const [inspectedCsesNick, setInspectedCsesNick] = useState<string>('');
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);

  // Settings & Storage State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);

  // Testing & Execution State
  const [customTestCases, setCustomTestCases] = useState<Record<string, TestCase[]>>({});
  const [activeTestCaseId, setActiveTestCaseId] = useState<string>('sample-1');
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [overallVerdict, setOverallVerdict] = useState<VerdictStatus | undefined>(undefined);
  const [submissionResults, setSubmissionResults] = useState<TestResult[] | null>(null);

  // Live CSES Problem Stats & Leaderboard Cache
  const [liveStats, setLiveStats] = useState<Record<string, ProblemStats>>({});
  const [isRefreshingStats, setIsRefreshingStats] = useState<boolean>(false);
  const [statsRefreshedAt, setStatsRefreshedAt] = useState<Record<string, number>>({});


  const handleFetchStats = useCallback(async (problemId: string, force: boolean = false) => {
    setIsRefreshingStats(true);
    try {
      const res = await fetch(`/api/cses/stats/${problemId}${force ? '?refresh=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        if (data.stats) {
          setLiveStats((prev) => ({ ...prev, [problemId]: data.stats }));
          setStatsRefreshedAt((prev) => ({ ...prev, [problemId]: data.cachedAt || Date.now() }));
        }
      }
    } catch (err) {
      console.warn('[Live Stats] Failed to fetch live stats:', err);
    } finally {
      setIsRefreshingStats(false);
    }
  }, []);

  // Fetch live stats when problem changes
  useEffect(() => {
    if (currentProblemId) {
      handleFetchStats(currentProblemId, false);
    }
  }, [currentProblemId, handleFetchStats]);

  // Resolved Current Problem Object (with live stats overlay)
  const currentProblem = useMemo(() => {
    const base = allProblems.find((p) => p.id === currentProblemId) || allProblems[0];
    if (liveStats[currentProblemId]) {
      return { ...base, stats: liveStats[currentProblemId] };
    }
    return base;
  }, [currentProblemId, liveStats]);

  // Combined test cases (Sample + Custom for current problem)
  const combinedTestCases = useMemo(() => {
    const custom = customTestCases[currentProblemId] || [];
    return [...(currentProblem.testCases || []), ...custom];
  }, [currentProblem, customTestCases, currentProblemId]);

  // Ensure activeTestCaseId is valid when problem changes
  useEffect(() => {
    if (combinedTestCases.length > 0) {
      const exists = combinedTestCases.some((tc) => tc.id === activeTestCaseId);
      if (!exists) {
        setActiveTestCaseId(combinedTestCases[0].id);
      }
    } else {
      setActiveTestCaseId('');
    }
  }, [combinedTestCases, activeTestCaseId]);

  // Initial client-side load (hydration safety)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load URL hash if present
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && allProblems.some((p) => p.id === hash)) {
      setCurrentProblemId(hash);
    }

    // Load settings & storage data
    const loadedSettings = getSettings();
    setSettings(loadedSettings);
    setSolvedIds(getSolvedProblems());

    // Load initial code draft or fallback to template
    const initialProbId = hash && allProblems.some((p) => p.id === hash) ? hash : '1068';
    const savedDraft = getDraft(initialProbId, 'cpp');
    setCode(savedDraft ?? getLanguageTemplate('cpp'));
    setSubmissions(getSubmissions(initialProbId));

    // Clean query parameters if redirected after OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth_success') === 'true' || urlParams.get('auth_error')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }

    // Check for existing Supabase Auth Session
    const supabase = getSupabase();
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          const user = mapSupabaseUser(data.session.user);
          setCurrentUser(user);
          // Continuous bidirectional cloud sync (solves, drafts, notes)
          syncAllLocalProgressToCloud(user.id).then(() => {
            setSolvedIds(getSolvedProblems());
          });
        }
      });

      const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const user = mapSupabaseUser(session.user);
          setCurrentUser(user);
          syncAllLocalProgressToCloud(user.id).then(() => {
            setSolvedIds(getSolvedProblems());
          });
        } else {
          setCurrentUser(null);
        }
      });

      return () => {
        authSub.subscription.unsubscribe();
      };
    }
  }, []);

  // Handler for when official CSES verdict is ACCEPTED
  const handleOfficialCsesAccepted = useCallback(
    (pId: string) => {
      setSolvedIds((prev) => {
        const updated = new Set(prev);
        updated.add(pId);
        saveSolvedProblem(pId);
        return updated;
      });

      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch {}

      if (currentUser) {
        syncUserDataToCloud(currentUser.id, {
          solvedIds: Array.from(new Set([...solvedIds, pId])),
          drafts: { [`cses_draft_${pId}_${activeLanguage}`]: code },
          submissions,
        });
      }

      // Immediately bypass cache and pull live CSES leaderboard containing the new submission
      handleFetchStats(pId, true);
    },
    [currentUser, solvedIds, activeLanguage, code, submissions, handleFetchStats]
  );

  const handleOpenCsesProfile = useCallback((nickOrId?: string, userId?: string) => {
    setInspectedCsesNick(userId || nickOrId || '');
    setIsCsesUserModalOpen(true);
  }, []);

  // Sync problem change with draft code and submissions
  const handleSelectProblem = useCallback(
    (id: string) => {
      if (id === currentProblemId) return;

      setCurrentProblemId(id);
      setTestResults({});
      setSubmissionResults(null);
      setOverallVerdict(undefined);

      // Load draft or template for the new problem
      const savedCode = getDraft(id, activeLanguage);
      setCode(savedCode ?? getLanguageTemplate(activeLanguage));
      setSubmissions(getSubmissions(id));

      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#${id}`);
      }
    },
    [currentProblemId, activeLanguage]
  );

  // Sync language change with draft code
  const handleLanguageChange = useCallback(
    (newLang: LanguageId) => {
      setActiveLanguage(newLang);
      const savedCode = getDraft(currentProblemId, newLang);
      setCode(savedCode ?? getLanguageTemplate(newLang));
    },
    [currentProblemId]
  );

  // Code editor change handler with auto-save
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      saveDraft(currentProblemId, activeLanguage, newCode);
    },
    [currentProblemId, activeLanguage]
  );

  // Reset template handler
  const handleResetTemplate = useCallback(() => {
    const template = getLanguageTemplate(activeLanguage);
    setCode(template);
    saveDraft(currentProblemId, activeLanguage, template);
  }, [currentProblemId, activeLanguage]);

  // Load code from past submission
  const handleSelectSubmissionCode = useCallback(
    (subCode: string, lang: LanguageId) => {
      setActiveLanguage(lang);
      setCode(subCode);
      saveDraft(currentProblemId, lang, subCode);
    },
    [currentProblemId]
  );

  // Settings update handler
  const handleUpdateSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  // Custom test case management
  const [isLoadingOfficialTests, setIsLoadingOfficialTests] = useState<boolean>(false);

  const handleLoadOfficialTests = useCallback(async () => {
    if (isLoadingOfficialTests) return;
    setIsLoadingOfficialTests(true);
    try {
      const res = await fetch(`/api/tests/${currentProblemId}?format=json`);
      if (!res.ok) throw new Error('Failed to load official tests');
      const data = await res.json();
      if (Array.isArray(data.testCases) && data.testCases.length > 0) {
        setCustomTestCases((prev) => {
          const existing = prev[currentProblemId] || [];
          const existingIds = new Set(existing.map((t) => t.id));
          const newTests = data.testCases.filter((t: TestCase) => !existingIds.has(t.id));
          return {
            ...prev,
            [currentProblemId]: [...existing, ...newTests],
          };
        });
        if (data.testCases[0]) {
          setActiveTestCaseId(data.testCases[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingOfficialTests(false);
    }
  }, [currentProblemId, isLoadingOfficialTests]);

  const handleAddCustomTestCase = useCallback(
    (input: string, expectedOutput: string) => {
      const newTc: TestCase = {
        id: `custom-${Date.now()}`,
        input,
        expectedOutput,
        isSample: false,
      };

      setCustomTestCases((prev) => ({
        ...prev,
        [currentProblemId]: [...(prev[currentProblemId] || []), newTc],
      }));
      setActiveTestCaseId(newTc.id);
    },
    [currentProblemId]
  );

  const handleDeleteCustomTestCase = useCallback(
    (id: string) => {
      setCustomTestCases((prev) => ({
        ...prev,
        [currentProblemId]: (prev[currentProblemId] || []).filter((tc) => tc.id !== id),
      }));
    },
    [currentProblemId]
  );

  // "RUN" Handler: Executes code for active test case
  const handleRun = useCallback(async () => {
    if (isRunning || isSubmitting) return;

    const targetTestCase =
      combinedTestCases.find((tc) => tc.id === activeTestCaseId) ||
      combinedTestCases[0];

    if (!targetTestCase) return;

    // Check if input size exceeds 100KB sandbox capacity
    if (isLargeInput(targetTestCase.input)) {
      setTestResults((prev) => ({
        ...prev,
        [targetTestCase.id]: {
          testCaseId: targetTestCase.id,
          status: 'SKIPPED',
          executionTimeMs: 0,
          memoryBytes: 0,
          actualOutput: '(Large input > 100KB: cloud compiler execution bypassed)',
          expectedOutput: targetTestCase.expectedOutput,
          stderr: `Notice: Test case input size (${(targetTestCase.input.length / 1024).toFixed(1)} KB) exceeds the 100KB OnlineCompiler.io sandbox limit. Marked as completed.`,
        },
      }));
      return;
    }

    setIsRunning(true);
    setOverallVerdict(undefined);

    // Set running state in testResults
    setTestResults((prev) => ({
      ...prev,
      [targetTestCase.id]: {
        testCaseId: targetTestCase.id,
        status: 'RUNNING',
        executionTimeMs: 0,
        memoryBytes: 0,
        actualOutput: '',
        expectedOutput: targetTestCase.expectedOutput,
      },
    }));

    try {
      const timeLimitSec = parseFloat(currentProblem.timeLimit) || 1.0;
      const res = await executeCode({
        language: activeLanguage,
        code,
        stdin: targetTestCase.input,
        endpoint: settings.compilerEndpoint,
        apiKey: settings.apiKey,
        timeoutMs: 25000, // Generous HTTP timeout for cloud compilation
      });

      const status = evaluateTestCase(
        targetTestCase.expectedOutput,
        res.output,
        res.exitCode,
        res.stderr,
        res.wallTimeMs,
        timeLimitSec
      );

      const diff = computeDiff(targetTestCase.expectedOutput, res.output);

      const testResult: TestResult = {
        testCaseId: targetTestCase.id,
        status,
        executionTimeMs: res.wallTimeMs,
        memoryBytes: res.memoryBytes,
        actualOutput: res.output,
        expectedOutput: targetTestCase.expectedOutput,
        stderr: res.stderr,
        diff: diff || undefined,
      };

      setTestResults((prev) => ({
        ...prev,
        [targetTestCase.id]: testResult,
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [targetTestCase.id]: {
          testCaseId: targetTestCase.id,
          status: 'RE',
          executionTimeMs: 0,
          memoryBytes: 0,
          actualOutput: '',
          expectedOutput: targetTestCase.expectedOutput,
          stderr: err?.message || 'Execution error occurred.',
        },
      }));
    } finally {
      setIsRunning(false);
    }
  }, [
    isRunning,
    isSubmitting,
    combinedTestCases,
    activeTestCaseId,
    currentProblem,
    activeLanguage,
    code,
    settings,
  ]);

  // "SUBMIT" Handler: Executes code against all test cases with progressive real-time feedback
  const handleSubmit = useCallback(async () => {
    if (isRunning || isSubmitting) return;
    if (combinedTestCases.length === 0) return;

    setIsSubmitting(true);
    setOverallVerdict('RUNNING');

    // 1. Initialize submission results matrix immediately:
    // First test marked RUNNING, subsequent tests marked IDLE (queued)
    const initialSubmissionMatrix: TestResult[] = combinedTestCases.map((tc, idx) => ({
      testCaseId: tc.id,
      status: idx === 0 ? 'RUNNING' : 'IDLE',
      executionTimeMs: 0,
      memoryBytes: 0,
      actualOutput: '',
      expectedOutput: tc.expectedOutput,
    }));
    setSubmissionResults(initialSubmissionMatrix);

    const initialResultsDict: Record<string, TestResult> = {};
    for (let idx = 0; idx < combinedTestCases.length; idx++) {
      const tc = combinedTestCases[idx];
      initialResultsDict[tc.id] = {
        testCaseId: tc.id,
        status: idx === 0 ? 'RUNNING' : 'IDLE',
        executionTimeMs: 0,
        memoryBytes: 0,
        actualOutput: '',
        expectedOutput: tc.expectedOutput,
      };
    }
    setTestResults(initialResultsDict);

    const evaluatedResults: TestResult[] = [];
    const timeLimitSec = parseFloat(currentProblem.timeLimit) || 1.0;

    let hasCE = false;
    let maxTime = 0;
    let maxMemory = 0;

    // 2. Run sequentially through each testcase (optimal for API limit: max 2 concurrent runs)
    for (let i = 0; i < combinedTestCases.length; i++) {
      const tc = combinedTestCases[i];

      // Mark current testcase as RUNNING in real-time
      setTestResults((prev) => ({
        ...prev,
        [tc.id]: {
          testCaseId: tc.id,
          status: 'RUNNING',
          executionTimeMs: 0,
          memoryBytes: 0,
          actualOutput: '',
          expectedOutput: tc.expectedOutput,
        },
      }));

      setSubmissionResults((prev) => {
        if (!prev) return prev;
        const updated = [...prev];
        updated[i] = {
          ...updated[i],
          status: 'RUNNING',
        };
        return updated;
      });

      // Check if input size exceeds OnlineCompiler.io 100KB limit
      if (isLargeInput(tc.input)) {
        const skippedResult: TestResult = {
          testCaseId: tc.id,
          status: 'SKIPPED',
          executionTimeMs: 0,
          memoryBytes: 0,
          actualOutput: '(Large input > 100KB: cloud execution bypassed)',
          expectedOutput: tc.expectedOutput,
          stderr: `Notice: Test case input size (${(tc.input.length / 1024).toFixed(1)} KB) exceeds the 100KB compiler sandbox limit. Automatically marked as done.`,
        };

        evaluatedResults.push(skippedResult);
        setTestResults((prev) => ({ ...prev, [tc.id]: skippedResult }));
        setSubmissionResults((prev) => {
          if (!prev) return [skippedResult];
          const updated = [...prev];
          updated[i] = skippedResult;
          return updated;
        });

        continue;
      }

      try {
        const res = await executeCode({
          language: activeLanguage,
          code,
          stdin: tc.input,
          endpoint: settings.compilerEndpoint,
          apiKey: settings.apiKey,
          timeoutMs: 25000, // Generous HTTP timeout for cloud compilation
        });

        const status = evaluateTestCase(
          tc.expectedOutput,
          res.output,
          res.exitCode,
          res.stderr,
          res.wallTimeMs,
          timeLimitSec
        );

        const diff = computeDiff(tc.expectedOutput, res.output);

        const tResult: TestResult = {
          testCaseId: tc.id,
          status,
          executionTimeMs: res.wallTimeMs,
          memoryBytes: res.memoryBytes,
          actualOutput: res.output,
          expectedOutput: tc.expectedOutput,
          stderr: res.stderr,
          diff: diff || undefined,
        };

        evaluatedResults.push(tResult);

        // Instantly update UI for this test case
        setTestResults((prev) => ({ ...prev, [tc.id]: tResult }));
        setSubmissionResults((prev) => {
          if (!prev) return [tResult];
          const updated = [...prev];
          updated[i] = tResult;
          return updated;
        });

        maxTime = Math.max(maxTime, res.wallTimeMs);
        maxMemory = Math.max(maxMemory, res.memoryBytes);

        if (status === 'CE') {
          hasCE = true;
          // Stop immediately on Compilation Error since subsequent runs will fail identically
          break;
        }
      } catch (err: any) {
        const errResult: TestResult = {
          testCaseId: tc.id,
          status: 'RE',
          executionTimeMs: 0,
          memoryBytes: 0,
          actualOutput: '',
          expectedOutput: tc.expectedOutput,
          stderr: err?.message || 'Execution failed',
        };
        evaluatedResults.push(errResult);
        setTestResults((prev) => ({ ...prev, [tc.id]: errResult }));
        setSubmissionResults((prev) => {
          if (!prev) return [errResult];
          const updated = [...prev];
          updated[i] = errResult;
          return updated;
        });
      }

      // Small cooldown between sequential requests to avoid backend container congestion
      if (i < combinedTestCases.length - 1 && !hasCE) {
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    }

    // 3. Summarize final results
    const summary = summarizeTestResults(evaluatedResults);
    const finalVerdict: VerdictStatus = hasCE ? 'CE' : summary.status;

    setOverallVerdict(finalVerdict);
    setSubmissionResults(evaluatedResults);

    const passedCount = summary.passedCount;

    // Record submission to localStorage
    const record: SubmissionRecord = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      problemId: currentProblem.id,
      language: activeLanguage,
      code,
      charCount: code.length,
      timestamp: Date.now(),
      status: finalVerdict,
      passedCount,
      totalCount: combinedTestCases.length,
      maxTimeMs: maxTime,
      maxMemoryBytes: maxMemory,
    };

    saveSubmission(record);
    setSubmissions(getSubmissions(currentProblem.id));

    // If Accepted: Fire Confetti Celebration & update Solved Problems
    if (finalVerdict === 'AC') {
      const updatedSolved = getSolvedProblems();
      updatedSolved.add(currentProblem.id);
      saveSolvedProblem(currentProblem.id);
      setSolvedIds(updatedSolved);

      // Cloud persistence symmetry for authenticated users
      if (currentUser) {
        syncUserDataToCloud(currentUser.id, {
          solvedIds: Array.from(updatedSolved),
          drafts: { [`cses_draft_${currentProblem.id}_${activeLanguage}`]: code },
          submissions: [record, ...submissions],
        });
      }

      try {
        confetti({
          particleCount: 120,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#10b981', '#38bdf8', '#818cf8', '#f59e0b', '#34d399'],
        });
      } catch {
        // Confetti fallback
      }
    }

    setIsSubmitting(false);
  }, [
    isRunning,
    isSubmitting,
    combinedTestCases,
    currentProblem,
    activeLanguage,
    code,
    settings,
    currentUser,
    submissions,
  ]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Toggle Command Palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      // Submit: Ctrl+Shift+Enter or Cmd+Shift+Enter
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      // Run: Ctrl+Enter or Cmd+Enter
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun, handleSubmit]);

  // Find user's best execution time for personal comparison scorecard
  const userBestTimeMs = useMemo(() => {
    const acSubs = submissions.filter((s) => s.status === 'AC');
    if (acSubs.length === 0) return undefined;
    return Math.min(...acSubs.map((s) => s.maxTimeMs));
  }, [submissions]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface-0 text-slate-100 font-sans">
      {/* Top Header */}
      <Header
        currentProblem={currentProblem}
        allProblems={allProblems}
        categories={categories}
        solvedCount={solvedIds.size}
        totalProblems={allProblems.length}
        onSelectProblem={handleSelectProblem}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        zenMode={zenMode}
        onToggleZenMode={() => setZenMode(!zenMode)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenArchive={() => setIsArchiveModalOpen(true)}
        onOpenCsesProfile={handleOpenCsesProfile}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 min-h-0 relative overflow-hidden">
        <SplitPane
          direction="horizontal"
          initialSize={42}
          minSize={25}
          maxSize={70}
          firstCollapsed={zenMode}
          className="h-full w-full"
        >
          {/* Left Pane: Problem Statement, Leaderboard, Submissions, Notes */}
          <div className="h-full w-full overflow-hidden bg-surface-1">
            <ProblemPane
              problem={currentProblem}
              submissions={submissions}
              isSolved={solvedIds.has(currentProblem.id)}
              onSelectCode={handleSelectSubmissionCode}
              userExecutionTimeMs={userBestTimeMs}
              userCharCount={code.length}
              onSelectUser={handleOpenCsesProfile}
              onRefreshStats={() => handleFetchStats(currentProblemId, true)}
              isRefreshingStats={isRefreshingStats}
              statsRefreshedAt={statsRefreshedAt[currentProblemId]}
              currentUser={currentUser}
              className="h-full w-full"
            />
          </div>

          {/* Right Pane: Vertical Split (Upper: EditorWorkbench, Lower: TestBench) */}
          <div className="h-full w-full overflow-hidden bg-surface-0">
            <SplitPane
              direction="vertical"
              initialSize={60}
              minSize={30}
              maxSize={80}
              className="h-full w-full"
            >
              {/* Upper Pane: Code Editor Workbench */}
              <div className="h-full w-full overflow-hidden bg-surface-1">
                <EditorWorkbench
                  code={code}
                  onChange={handleCodeChange}
                  language={activeLanguage}
                  onLanguageChange={handleLanguageChange}
                  onResetTemplate={handleResetTemplate}
                  onRun={handleRun}
                  onSubmit={handleSubmit}
                  onSubmitCses={() => setIsCsesSubmitModalOpen(true)}
                  isRunning={isRunning}
                  isSubmitting={isSubmitting}
                  fontSize={settings.fontSize}
                  problemId={currentProblem.id}
                  problemTitle={currentProblem.title}
                  apiKey={settings.apiKey}
                  widgetKey={settings.widgetKey}
                  onSaveWidgetKey={(key) =>
                    setSettings((prev) => ({ ...prev, widgetKey: key }))
                  }
                  defaultEditorMode={
                    settings.defaultEditor === 'inbuilt' ? 'embed' : 'monaco'
                  }
                  className="h-full w-full"
                />
              </div>

              {/* Lower Pane: Test Bench, Testcases, Diff Inspector */}
              <div className="h-full w-full overflow-hidden bg-surface-1">
                <TestBench
                  testCases={combinedTestCases}
                  results={testResults}
                  activeTestCaseId={activeTestCaseId}
                  onSelectTestCase={setActiveTestCaseId}
                  onAddCustomTestCase={handleAddCustomTestCase}
                  onDeleteCustomTestCase={handleDeleteCustomTestCase}
                  onLoadOfficialTests={handleLoadOfficialTests}
                  isLoadingOfficialTests={isLoadingOfficialTests}
                  problemId={currentProblemId}
                  isRunning={isRunning || isSubmitting}
                  overallStatus={overallVerdict}
                  submissionResults={submissionResults}
                  className="h-full w-full"
                />
              </div>
            </SplitPane>
          </div>
        </SplitPane>
      </main>

      {/* Accessible Modals */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        problems={allProblems}
        onSelectProblem={handleSelectProblem}
        solvedIds={solvedIds}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Public Auth Modal (GitHub 1-click login) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChange={setCurrentUser}
        solvedCount={solvedIds.size}
      />

      {/* Direct CSES Remote Submit Modal */}
      <CsesSubmitModal
        isOpen={isCsesSubmitModalOpen}
        onClose={() => setIsCsesSubmitModalOpen(false)}
        problemId={currentProblem.id}
        problemTitle={currentProblem.title}
        language={activeLanguage}
        code={code}
        onAccepted={handleOfficialCsesAccepted}
      />

      {/* CSES User Profile Inspector Modal */}
      <CsesUserProfileModal
        isOpen={isCsesUserModalOpen}
        onClose={() => setIsCsesUserModalOpen(false)}
        initialNick={inspectedCsesNick}
        onSelectProblem={handleSelectProblem}
      />

      {/* CSES Continuous Mirror & Archive Explorer */}
      <ArchiveExplorerModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        onSelectProblem={handleSelectProblem}
      />
    </div>
  );
}
