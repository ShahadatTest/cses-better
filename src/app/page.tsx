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
  removeSolvedProblem,
  getStarredProblems,
  saveStarredProblem,
  removeStarredProblem,
  cleanEmptySubmissions,
  getSettings,
  saveSettings,
  getStoredUser,
  saveStoredUser,
  clearStoredUser,
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
import {
  playVerdictChime,
  sendDesktopNotification,
  requestNotificationPermission,
} from '../core/notifications';
import { Check, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
import { CsesAccountModal } from '../components/CsesAccountModal';
import { AllNotesModal } from '../components/AllNotesModal';

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
  const [isCsesAccountModalOpen, setIsCsesAccountModalOpen] = useState<boolean>(false);
  const [isAllNotesOpen, setIsAllNotesOpen] = useState<boolean>(false);

  // Settings & Storage State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);

  // Testing & Execution State
  const [customTestCases, setCustomTestCases] = useState<Record<string, TestCase[]>>({});
  const [activeTestCaseId, setActiveTestCaseId] = useState<string>('sample-1');
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isPausedRef = React.useRef<boolean>(false);
  const isCancelledRef = React.useRef<boolean>(false);
  const [overallVerdict, setOverallVerdict] = useState<VerdictStatus | undefined>(undefined);
  const [submissionResults, setSubmissionResults] = useState<TestResult[] | null>(null);
  const [completionToast, setCompletionToast] = useState<{
    status: VerdictStatus;
    message: string;
    submessage?: string;
  } | null>(null);

  const handleTogglePause = useCallback(() => {
    if (!isSubmitting) return;
    const nextPaused = !isPausedRef.current;
    isPausedRef.current = nextPaused;
    setIsPaused(nextPaused);
    setOverallVerdict(nextPaused ? 'PAUSED' : 'RUNNING');
  }, [isSubmitting]);

  const handleCancelSubmit = useCallback(() => {
    if (!isSubmitting) return;
    isCancelledRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
  }, [isSubmitting]);

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
    cleanEmptySubmissions();
    const loadedSettings = getSettings();
    setSettings(loadedSettings);
    setSolvedIds(getSolvedProblems());
    setStarredIds(getStarredProblems());

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

    // Immediate local user hydration
    const cachedUser = getStoredUser();
    if (cachedUser) {
      setCurrentUser(cachedUser);
    }

    // Check for existing Supabase Auth Session
    const supabase = getSupabase();
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          const user = mapSupabaseUser(data.session.user);
          setCurrentUser(user);
          saveStoredUser(user);
          // Continuous bidirectional cloud sync (solves, drafts, notes, starred)
          syncAllLocalProgressToCloud(user.id).then(() => {
            setSolvedIds(getSolvedProblems());
            setStarredIds(getStarredProblems());
          });
        }
      });

      const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const user = mapSupabaseUser(session.user);
          setCurrentUser(user);
          saveStoredUser(user);
          syncAllLocalProgressToCloud(user.id).then(() => {
            setSolvedIds(getSolvedProblems());
            setStarredIds(getStarredProblems());
          });
        } else {
          setCurrentUser(null);
          clearStoredUser();
        }
      });

      return () => {
        authSub.subscription.unsubscribe();
      };
    }
  }, []);

  // Handler for when official CSES verdict is ACCEPTED
  const handleOfficialCsesAccepted = useCallback(
    (pId: string, acceptedCode?: string, lang?: LanguageId) => {
      const finalCode = acceptedCode || code;
      const finalLang = lang || activeLanguage;

      setSolvedIds((prev) => {
        const updated = new Set(prev);
        updated.add(pId);
        saveSolvedProblem(pId, finalLang, finalCode);
        return updated;
      });

      // Save submission record so it appears with code in My Workbench Runs
      if (finalCode && finalCode.trim()) {
        const officialRecord: SubmissionRecord = {
          id: `cses-sub-${Date.now()}`,
          problemId: pId,
          language: finalLang,
          code: finalCode,
          charCount: finalCode.length,
          timestamp: Date.now(),
          status: 'AC',
          passedCount: 1,
          totalCount: 1,
          maxTimeMs: 0,
          maxMemoryBytes: 1024 * 1024,
        };
        saveSubmission(officialRecord);
        setSubmissions(getSubmissions(pId));
      }

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
          drafts: { [`cses_draft_${pId}_${finalLang}`]: finalCode },
          submissions,
        });
      }

      // Immediately bypass cache and pull live CSES leaderboard containing the new submission
      handleFetchStats(pId, true);
    },
    [currentUser, solvedIds, activeLanguage, code, submissions, handleFetchStats]
  );

  // Manual toggle for problem solved status from tick boxes
  const handleToggleSolved = useCallback(
    (pId: string) => {
      setSolvedIds((prev) => {
        const updated = new Set(prev);
        if (updated.has(pId)) {
          updated.delete(pId);
          removeSolvedProblem(pId);
        } else {
          updated.add(pId);
          saveSolvedProblem(pId, activeLanguage, code);
          try {
            confetti({
              particleCount: 75,
              spread: 60,
              origin: { y: 0.6 },
            });
          } catch {}
        }

        if (currentUser) {
          syncUserDataToCloud(currentUser.id, {
            solvedIds: Array.from(updated),
          }).catch((e) => console.warn('[Cloud sync notice]:', e));
        }

        return updated;
      });
    },
    [currentUser, activeLanguage, code]
  );

  // Manual toggle for problem starred status
  const handleToggleStarred = useCallback(
    (pId: string) => {
      setStarredIds((prev) => {
        const updated = new Set(prev);
        if (updated.has(pId)) {
          updated.delete(pId);
          removeStarredProblem(pId);
        } else {
          updated.add(pId);
          saveStarredProblem(pId);
        }

        if (currentUser) {
          syncUserDataToCloud(currentUser.id, {
            starredIds: Array.from(updated),
          }).catch((e) => console.warn('[Cloud sync notice]:', e));
        }

        return updated;
      });
    },
    [currentUser]
  );

  const handleOpenCsesProfile = useCallback((nickOrId?: string, userId?: string) => {
    setInspectedCsesNick(userId || nickOrId || '');
    setIsCsesUserModalOpen(true);
  }, []);

  const handleCsesSolvesSynced = useCallback(
    (newSolvedIds: string[]) => {
      setSolvedIds((prev) => {
        const updated = new Set(prev);
        newSolvedIds.forEach((id) => {
          updated.add(id);
          saveSolvedProblem(id);
        });
        return updated;
      });

      if (currentUser) {
        syncUserDataToCloud(currentUser.id, {
          solvedIds: Array.from(new Set([...solvedIds, ...newSolvedIds])),
        }).catch((e) => console.warn('[Cloud sync notice]:', e));
      }
    },
    [currentUser, solvedIds]
  );

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

  // "SUBMIT" Handler: Executes code against test cases in parallel according to rate limits with Pause/Resume and Notifications
  const handleSubmit = useCallback(async () => {
    if (isRunning || isSubmitting) return;
    if (combinedTestCases.length === 0) return;

    // Prompt desktop notification permission in the background if not yet requested
    requestNotificationPermission().catch(() => {});

    setIsSubmitting(true);
    setIsPaused(false);
    isPausedRef.current = false;
    isCancelledRef.current = false;
    setOverallVerdict('RUNNING');

    // 1. Initialize submission results matrix immediately: all tests marked IDLE
    const initialSubmissionMatrix: TestResult[] = combinedTestCases.map((tc) => ({
      testCaseId: tc.id,
      status: 'IDLE',
      executionTimeMs: 0,
      memoryBytes: 0,
      actualOutput: '',
      expectedOutput: tc.expectedOutput,
    }));
    setSubmissionResults(initialSubmissionMatrix);

    const initialResultsDict: Record<string, TestResult> = {};
    for (const tc of combinedTestCases) {
      initialResultsDict[tc.id] = {
        testCaseId: tc.id,
        status: 'IDLE',
        executionTimeMs: 0,
        memoryBytes: 0,
        actualOutput: '',
        expectedOutput: tc.expectedOutput,
      };
    }
    setTestResults(initialResultsDict);

    const evaluatedResults: TestResult[] = new Array(combinedTestCases.length);
    const timeLimitSec = parseFloat(currentProblem.timeLimit) || 1.0;

    let nextIndex = 0;
    let hasCE = false;
    let maxTime = 0;
    let maxMemory = 0;

    // 2. Parallel Worker Pool: concurrency of 2 stays safely under API rate limits while cutting wait time in half
    const concurrency = Math.min(2, combinedTestCases.length);

    const runWorker = async (workerId: number) => {
      // Stagger start slightly to avoid simultaneous network bursts
      if (workerId > 0) {
        await new Promise((resolve) => setTimeout(resolve, workerId * 140));
      }

      while (true) {
        // Handle Pause state: wait while paused unless cancelled
        while (isPausedRef.current && !isCancelledRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }

        // Check if Cancelled or has Compilation Error
        if (isCancelledRef.current || hasCE) {
          break;
        }

        // Claim next available testcase
        const i = nextIndex++;
        if (i >= combinedTestCases.length) {
          break;
        }

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

          evaluatedResults[i] = skippedResult;
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
            timeoutMs: 25000,
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

          evaluatedResults[i] = tResult;

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
          evaluatedResults[i] = errResult;
          setTestResults((prev) => ({ ...prev, [tc.id]: errResult }));
          setSubmissionResults((prev) => {
            if (!prev) return [errResult];
            const updated = [...prev];
            updated[i] = errResult;
            return updated;
          });
        }

        // Small inter-run breath to prevent TCP socket exhaustion
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    };

    const workers = Array.from({ length: concurrency }, (_, workerId) => runWorker(workerId));
    await Promise.all(workers);

    // 3. Summarize final results
    const completedResults = evaluatedResults.filter(Boolean);
    const summary = summarizeTestResults(completedResults.length > 0 ? completedResults : []);
    const finalVerdict: VerdictStatus = isCancelledRef.current
      ? (completedResults.length > 0 ? summary.status : 'WA')
      : hasCE
      ? 'CE'
      : summary.status;

    setOverallVerdict(finalVerdict);
    setSubmissionResults(
      evaluatedResults.map((r, idx) => r || {
        testCaseId: combinedTestCases[idx].id,
        status: isCancelledRef.current ? 'IDLE' : hasCE ? 'CE' : 'IDLE',
        executionTimeMs: 0,
        memoryBytes: 0,
        actualOutput: '',
        expectedOutput: combinedTestCases[idx].expectedOutput,
      })
    );

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
    if (finalVerdict === 'AC' && !isCancelledRef.current) {
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

    // 4. Send Completion Notifications (Desktop Notification + Audio Chime + Floating In-App Toast)
    sendDesktopNotification(
      finalVerdict === 'AC'
        ? `Accepted! #${currentProblem.id} ${currentProblem.title}`
        : `Evaluation Finished: ${finalVerdict} (#${currentProblem.id})`,
      {
        body: `${passedCount} of ${combinedTestCases.length} test cases passed (Max runtime: ${maxTime} ms)`,
      }
    );

    playVerdictChime(finalVerdict);

    setCompletionToast({
      status: finalVerdict,
      message:
        finalVerdict === 'AC'
          ? `Accepted! All ${passedCount} test cases passed!`
          : isCancelledRef.current
          ? `Execution Stopped (${passedCount}/${combinedTestCases.length} completed)`
          : `Verdict: ${finalVerdict} (${passedCount}/${combinedTestCases.length} passed)`,
      submessage: `Max time: ${maxTime} ms • Memory: ${(maxMemory / (1024 * 1024)).toFixed(1)} MB`,
    });

    setTimeout(() => {
      setCompletionToast(null);
    }, 5000);

    setIsSubmitting(false);
    setIsPaused(false);
    isPausedRef.current = false;
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
        solvedProblemIds={solvedIds}
        onToggleSolved={handleToggleSolved}
        starredProblemIds={starredIds}
        onToggleStarred={handleToggleStarred}
        onSelectProblem={handleSelectProblem}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        zenMode={zenMode}
        onToggleZenMode={() => setZenMode(!zenMode)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenArchive={() => setIsArchiveModalOpen(true)}
        onOpenAllNotes={() => setIsAllNotesOpen(true)}
        onOpenCsesProfile={handleOpenCsesProfile}
        onOpenCsesAccount={() => setIsCsesAccountModalOpen(true)}
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
              isStarred={starredIds.has(currentProblem.id)}
              onToggleStar={handleToggleStarred}
              onSelectCode={handleSelectSubmissionCode}
              userExecutionTimeMs={userBestTimeMs}
              userCharCount={code.length}
              onSelectUser={handleOpenCsesProfile}
              onRefreshStats={() => handleFetchStats(currentProblemId, true)}
              isRefreshingStats={isRefreshingStats}
              statsRefreshedAt={statsRefreshedAt[currentProblemId]}
              currentUser={currentUser}
              onOpenCsesAccount={() => setIsCsesAccountModalOpen(true)}
              onSelectProblem={handleSelectProblem}
              onOpenAllNotes={() => setIsAllNotesOpen(true)}
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
                  isPaused={isPaused}
                  onPauseResume={handleTogglePause}
                  onCancel={handleCancelSubmit}
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
                  isPaused={isPaused}
                  onPauseResume={handleTogglePause}
                  onCancel={handleCancelSubmit}
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
        onUserChange={(user) => {
          setCurrentUser(user);
          saveStoredUser(user);
        }}
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
        onAccepted={(pId) => handleOfficialCsesAccepted(pId, code, activeLanguage)}
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
        solvedIds={solvedIds}
        onToggleSolved={handleToggleSolved}
        starredIds={starredIds}
        onToggleStarred={handleToggleStarred}
      />

      {/* Official CSES Account Connect & Solves Sync Modal */}
      <CsesAccountModal
        isOpen={isCsesAccountModalOpen}
        onClose={() => setIsCsesAccountModalOpen(false)}
        onSolvesSynced={handleCsesSolvesSynced}
      />

      {/* CSES Notebook: All Problem Notes Modal */}
      <AllNotesModal
        isOpen={isAllNotesOpen}
        onClose={() => setIsAllNotesOpen(false)}
        onSelectProblem={(id) => {
          handleSelectProblem(id);
          setIsAllNotesOpen(false);
        }}
        currentProblemId={currentProblemId}
        allProblems={allProblems}
      />

      {/* Floating Completion Toast Notification */}
      {completionToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 p-3.5 rounded-xl bg-surface-1/95 border border-border-muted shadow-2xl backdrop-blur-md text-slate-100 max-w-md animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border',
              completionToast.status === 'AC'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : completionToast.status === 'WA'
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : completionToast.status === 'CE'
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            )}
          >
            {completionToast.status === 'AC' ? (
              <Check className="w-4 h-4 stroke-[3]" />
            ) : completionToast.status === 'WA' ? (
              <X className="w-4 h-4 stroke-[3]" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-slate-200">
              {completionToast.message}
            </p>
            {completionToast.submessage && (
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {completionToast.submessage}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCompletionToast(null)}
            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
