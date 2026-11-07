'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Lock,
  User,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  CsesCredentials,
  CsesVerdictResult,
  LanguageId,
  VerdictStatus,
  SubmissionRecord,
} from '@/core/types';
import { saveSubmission } from '@/core/storage';
import {
  getStoredCsesCredentials,
  saveStoredCsesCredentials,
  submitToCses,
  pollCsesVerdict,
} from '@/core/cses-client';

interface CsesSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  problemId: string;
  problemTitle: string;
  language: LanguageId;
  code: string;
  onAccepted?: (problemId: string, result?: CsesVerdictResult) => void;
  onCompleted?: (record: SubmissionRecord) => void;
}

type SubmissionStage =
  | 'IDLE'
  | 'AUTHENTICATING'
  | 'CSRF_HANDSHAKE'
  | 'TRANSMITTING'
  | 'POLLING'
  | 'UNRESOLVED'
  | 'COMPLETED'
  | 'ERROR';

function officialMetric(value?: string, kind: 'time' | 'memory' = 'time'): number {
  if (!value) return 0;
  const match = value.match(/[\d.]+\s*(ms|s|KiB|MiB|GiB|KB|MB|GB|B)?/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[0]);
  const unit = (match[1] || '').toLowerCase();
  if (!Number.isFinite(amount)) return 0;
  if (kind === 'time') return unit === 'ms' ? Math.round(amount) : unit === 's' ? Math.round(amount * 1000) : 0;
  const powers: Record<string, number> = { b: 1, kb: 1000, mb: 1e6, gb: 1e9, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3 };
  return Math.round(amount * (powers[unit] || 0));
}

export function CsesSubmitModal({
  isOpen,
  onClose,
  problemId,
  problemTitle,
  language,
  code,
  onAccepted,
  onCompleted,
}: CsesSubmitModalProps) {
  const [nick, setNick] = useState('');
  const [pass, setPass] = useState('');
  const [remember, setRemember] = useState(false);
  const [useBot, setUseBot] = useState(false);

  const [stage, setStage] = useState<SubmissionStage>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verdictResult, setVerdictResult] = useState<CsesVerdictResult | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submissionOwner, setSubmissionOwner] = useState<{ nick?: string; userId?: string; isPersonal?: boolean } | undefined>();
  const pollController = useRef<AbortController | null>(null);
  const requestGeneration = useRef(0);

  // Load stored credentials on mount or modal open
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredCsesCredentials();
      if (stored) {
        setNick(stored.nick);
        setPass('');
        setRemember(stored.remember === true);
      }
      setStage('IDLE');
      setErrorMessage(null);
      setVerdictResult(null);
      setSubmissionId(null);
      setSubmissionOwner(undefined);
    }
  }, [isOpen]);

  useEffect(() => () => {
    requestGeneration.current += 1;
    pollController.current?.abort();
  }, [isOpen, problemId]);

  const closeModal = () => {
    requestGeneration.current += 1;
    pollController.current?.abort();
    onClose();
  };

  if (!isOpen) return null;

  const handleSubmitToCses = async () => {
    const storedCsesAccount = getStoredCsesCredentials();
    const sameStoredAccount = storedCsesAccount?.nick.trim().toLocaleLowerCase() === nick.trim().toLocaleLowerCase();
    const sessionCookie = !pass && sameStoredAccount ? storedCsesAccount?.sessionCookie : undefined;
    if (!useBot && (!nick.trim() || (!pass && !sessionCookie))) {
      setErrorMessage('Enter your CSES nickname and password, or connect a remembered CSES session.');
      return;
    }

    setErrorMessage(null);
    setStage('AUTHENTICATING');
    const generation = ++requestGeneration.current;

    try {
      setStage('TRANSMITTING');
      const submitRes = await submitToCses({
        nick: useBot ? undefined : nick.trim(),
        userId: useBot || !sameStoredAccount ? undefined : storedCsesAccount?.userId,
        pass: useBot ? undefined : pass,
        sessionCookie: useBot ? undefined : sessionCookie,
        problemId,
        language,
        code,
        useDefaultBot: useBot,
      });
      setPass('');
      if (generation !== requestGeneration.current) return;

      if (!submitRes.success || !submitRes.submissionId) {
        setStage('ERROR');
        setErrorMessage(submitRes.error || 'CSES rejected the submission.');
        return;
      }

      if (submitRes.sessionCookie && !useBot) {
        saveStoredCsesCredentials({
          nick: nick.trim(),
          userId: submitRes.owner?.userId,
          sessionCookie: submitRes.sessionCookie,
          remember,
        });
      }

      setSubmissionId(submitRes.submissionId);
      setSubmissionOwner(submitRes.owner);
      await checkCsesResult(submitRes.submissionId, submitRes.sessionCookie, submitRes.owner);
    } catch (err: any) {
      setPass('');
      if (generation !== requestGeneration.current) return;
      setStage('ERROR');
      setErrorMessage(err?.message || 'Failed to submit to CSES');
      setStage('ERROR');
    }
  };

  const checkCsesResult = async (id: string, sessionCookie?: string, owner = submissionOwner) => {
    pollController.current?.abort();
    const controller = new AbortController();
    pollController.current = controller;
    setStage('POLLING');
    try {
      const polled = await pollCsesVerdict(id, (partial) => setVerdictResult({ ...partial, owner }), 40, 1500, sessionCookie, problemId, controller.signal);
      if (controller.signal.aborted) return;
      const result = { ...polled, owner };
      setVerdictResult(result);
      const final = !['PENDING', 'TESTING', 'UNKNOWN'].includes(result.status) &&
        (result.lifecycleStatus === 'FINISHED' || result.lifecycleStatus === undefined);
      if (!final) {
        setStage('UNRESOLVED');
        return;
      }
      setStage('COMPLETED');
      const statusMap: Record<string, VerdictStatus> = {
        'ACCEPTED': 'AC', 'WRONG ANSWER': 'WA', 'TIME LIMIT EXCEEDED': 'TLE',
        'MEMORY LIMIT EXCEEDED': 'MLE', 'OUTPUT LIMIT EXCEEDED': 'OLE',
        'COMPILE ERROR': 'CE', 'RUNTIME ERROR': 'RE',
      };
      const passedCount = result.tests.filter((t) => /ACCEPTED/i.test(t.verdict)).length;
      const record: SubmissionRecord = {
        id: `cses-${id}`, problemId, language, code, charCount: code.length,
        timestamp: result.timestamp ?? Date.now(), status: statusMap[result.status] || 'PAUSED',
        passedCount, totalCount: result.tests.length,
        maxTimeMs: officialMetric(result.totalTime),
        maxMemoryBytes: officialMetric(result.totalMemory, 'memory'),
        source: 'cses', officialResult: result, officialSubmissionId: id,
        officialOwner: result.owner?.nick,
      };
      saveSubmission(record);
      onCompleted?.(record);
      if (result.status === 'ACCEPTED') onAccepted?.(problemId, result);
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setStage('UNRESOLVED');
        setErrorMessage(err?.message || 'Could not check the CSES result.');
      }
    }
  };

  const getVerdictBadge = (status: CsesVerdictResult['status']) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>ACCEPTED</span>
          </div>
        );
      case 'WRONG ANSWER':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg font-bold text-sm">
            <XCircle className="w-4 h-4" />
            <span>WRONG ANSWER</span>
          </div>
        );
      case 'TIME LIMIT EXCEEDED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-lg font-bold text-sm">
            <Clock className="w-4 h-4" />
            <span>TIME LIMIT EXCEEDED</span>
          </div>
        );
      case 'MEMORY LIMIT EXCEEDED':
        return <div className="rounded-lg border border-purple-500/30 bg-purple-500/15 px-3 py-1 text-sm font-bold text-purple-300">MEMORY LIMIT EXCEEDED</div>;
      case 'OUTPUT LIMIT EXCEEDED':
        return <div className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-sm font-bold text-amber-300">OUTPUT LIMIT EXCEEDED</div>;
      case 'COMPILE ERROR':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-lg font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>COMPILE ERROR</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg font-bold text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{status}</span>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-zinc-100 flex items-center gap-2">
                Submit to CSES.fi
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Official Judge
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Problem #{problemId}: {problemTitle} ({language.toUpperCase()})
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl flex items-start gap-2.5 text-red-400 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {stage === 'IDLE' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-zinc-800/40 border border-zinc-700/50 rounded-xl text-xs text-zinc-300 leading-relaxed space-y-1">
                <div className="flex items-center gap-1.5 text-blue-400 font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Official Submission Handshake</span>
                </div>
                <p>
                  Our server safely connects to <code>cses.fi</code> using IPv4, fetches the CSRF token, and submits your code under your official CSES account.
                </p>
              </div>

              {/* Bot or Personal Account Switch */}
              <div className="flex items-center gap-2 p-1 bg-zinc-800/60 rounded-xl border border-zinc-700/60 text-xs">
                <button
                  type="button"
                  onClick={() => setUseBot(false)}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
                    !useBot
                      ? 'bg-zinc-700 text-zinc-100 shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  My CSES Account
                </button>
                <button
                  type="button"
                  onClick={() => setUseBot(true)}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
                    useBot
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Shared Bot (csesbetter99)
                </button>
              </div>

              {useBot ? (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 leading-relaxed space-y-1">
                  <p className="font-semibold text-emerald-400">Submitting with Shared Bot</p>
                  <p>
                    Your solution will be submitted to the official CSES judge using the shared bot account, when the server operator has configured it.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      CSES Nickname / Handle
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={nick}
                        onChange={(e) => setNick(e.target.value)}
                        placeholder="e.g. tourist or your_nick"
                        className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      CSES Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="rememberCreds"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <label
                      htmlFor="rememberCreds"
                      className="text-xs text-zinc-400 select-none cursor-pointer"
                    >
                      Remember this CSES session in this browser (optional)
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submission Pipeline Progress */}
          {(stage === 'AUTHENTICATING' ||
            stage === 'CSRF_HANDSHAKE' ||
            stage === 'TRANSMITTING' ||
            stage === 'POLLING' ||
            stage === 'UNRESOLVED' ||
            stage === 'COMPLETED') && (
            <div className="space-y-4">
              <div className="p-4 bg-zinc-800/60 border border-zinc-700/60 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">CSES Live Pipeline</span>
                  {verdictResult && getVerdictBadge(verdictResult.status)}
                </div>

                {/* Progress bar / stage status */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    {stage === 'AUTHENTICATING' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    )}
                    {stage !== 'AUTHENTICATING' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span className={stage === 'AUTHENTICATING' ? 'text-blue-400 font-medium' : 'text-zinc-400'}>
                      1. Authenticating with cses.fi
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {stage === 'TRANSMITTING' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    )}
                    {['POLLING', 'UNRESOLVED', 'COMPLETED'].includes(stage) ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-zinc-600" />
                    )}
                    <span className={stage === 'TRANSMITTING' ? 'text-blue-400 font-medium' : 'text-zinc-400'}>
                      2. Extracting CSRF Token & Transmitting Solution
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {stage === 'POLLING' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    )}
                    {stage === 'COMPLETED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : stage === 'UNRESOLVED' ? (
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-zinc-600" />
                    )}
                    <span className={stage === 'POLLING' ? 'text-blue-400 font-medium' : 'text-zinc-400'}>
                      3. Official Judge Queue & Execution
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Test Verdicts Matrix */}
              {verdictResult && verdictResult.tests.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Test Cases: {verdictResult.tests.length} tests</span>
                    {verdictResult.totalTime && <span>Total Time: {verdictResult.totalTime}</span>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1">
                    {verdictResult.tests.map((t) => (
                      <div
                        key={t.index}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                          t.verdict.toUpperCase().includes('ACCEPTED')
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/10 border-red-500/20 text-red-300'
                        }`}
                      >
                        <span className="font-mono">#{t.index}</span>
                        <span className="font-semibold text-[11px]">{t.verdict}</span>
                        <span className="text-[10px] opacity-75">{t.time}{t.memory ? ` · ${t.memory}` : ''}</span>
                      </div>
                    ))}
                  </div>
                  {verdictResult.tests.some((t) => t.input || t.expectedOutput || t.actualOutput) && (
                    <div className="space-y-1.5">
                      {verdictResult.tests.filter((t) => t.input || t.expectedOutput || t.actualOutput).map((test) => (
                        <details key={`detail-${test.index}`} className="rounded border border-zinc-700 bg-zinc-800/50 px-2.5 py-2 text-xs">
                          <summary className="cursor-pointer text-zinc-300">Test #{test.index} details shown by CSES</summary>
                          {[['Input', test.input], ['Expected', test.expectedOutput], ['Your output', test.actualOutput]].map(([label, value]) => value && (
                            <pre key={label} className="mt-2 whitespace-pre-wrap break-words text-zinc-400"><span className="text-zinc-200">{label}: </span>{value}</pre>
                          ))}
                          {test.detailsUrl && <a className="mt-2 inline-block text-blue-300 underline" href={test.detailsUrl} target="_blank" rel="noopener noreferrer">Open CSES test detail</a>}
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {verdictResult && <div className="text-xs text-zinc-400">Official result: <span className="text-zinc-200">{verdictResult.rawStatusText}</span> · Time {verdictResult.totalTime || '—'} · Memory {verdictResult.totalMemory || '—'}</div>}
              {verdictResult?.compilerOutput && <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-3 text-xs text-orange-200">{verdictResult.compilerOutput}</pre>}
              {stage === 'UNRESOLVED' && submissionId && (
                <button type="button" onClick={() => checkCsesResult(submissionId)} className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium">Check official result again</button>
              )}

              {/* Direct Link to CSES Result */}
              {verdictResult && (
                <a
                  href={verdictResult.resultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-blue-400 text-xs font-medium rounded-xl border border-zinc-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Official Result on CSES.fi
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-end gap-3 shrink-0">
          {stage === 'IDLE' && (
            <>
              <button
                onClick={closeModal}
                className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitToCses}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-emerald-900/30 transition-all"
              >
                <Send className="w-4 h-4" />
                Submit to CSES
              </button>
            </>
          )}

          {stage === 'COMPLETED' && (
            <button
              onClick={closeModal}
              className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl border border-zinc-700 transition-colors"
            >
              Done
            </button>
          )}

          {stage === 'UNRESOLVED' && <button onClick={closeModal} className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl border border-zinc-700 transition-colors">Close and check later</button>}

          {stage === 'ERROR' && (
            <button
              onClick={() => setStage('IDLE')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
