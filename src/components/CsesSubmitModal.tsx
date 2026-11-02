'use client';

import React, { useState, useEffect } from 'react';
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
  onAccepted?: (problemId: string) => void;
}

type SubmissionStage =
  | 'IDLE'
  | 'AUTHENTICATING'
  | 'CSRF_HANDSHAKE'
  | 'TRANSMITTING'
  | 'POLLING'
  | 'COMPLETED'
  | 'ERROR';

export function CsesSubmitModal({
  isOpen,
  onClose,
  problemId,
  problemTitle,
  language,
  code,
  onAccepted,
}: CsesSubmitModalProps) {
  const [nick, setNick] = useState('');
  const [pass, setPass] = useState('');
  const [remember, setRemember] = useState(true);
  const [useBot, setUseBot] = useState(false);

  const [stage, setStage] = useState<SubmissionStage>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verdictResult, setVerdictResult] = useState<CsesVerdictResult | null>(null);

  // Load stored credentials on mount or modal open
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredCsesCredentials();
      if (stored) {
        setNick(stored.nick);
        setPass(stored.pass || '');
        setRemember(true);
      }
      setStage('IDLE');
      setErrorMessage(null);
      setVerdictResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmitToCses = async () => {
    if (!useBot && (!nick.trim() || !pass)) {
      setErrorMessage('Please enter both your CSES nickname and password, or use the Shared Bot.');
      return;
    }

    setErrorMessage(null);
    setStage('AUTHENTICATING');

    if (!useBot) {
      // Save or clear credentials
      saveStoredCsesCredentials({
        nick: nick.trim(),
        pass,
        remember,
      });
    }

    try {
      setStage('TRANSMITTING');
      const submitRes = await submitToCses({
        nick: useBot ? undefined : nick.trim(),
        pass: useBot ? undefined : pass,
        problemId,
        language,
        code,
        useDefaultBot: useBot,
      });

      if (!submitRes.success || !submitRes.submissionId) {
        setStage('ERROR');
        setErrorMessage(submitRes.error || 'CSES rejected the submission.');
        return;
      }

      if (submitRes.sessionCookie && !useBot) {
        saveStoredCsesCredentials({
          nick: nick.trim(),
          pass,
          sessionCookie: submitRes.sessionCookie,
          remember,
        });
      }

      setStage('POLLING');

      // Poll live CSES result passing the authenticated session cookie and problemId
      const finalResult = await pollCsesVerdict(
        submitRes.submissionId,
        (partial) => {
          setVerdictResult(partial);
        },
        40,
        1500,
        submitRes.sessionCookie,
        problemId
      );

      setVerdictResult(finalResult);
      setStage('COMPLETED');

      // Persist real submission record with source code into local history
      try {
        const statusMap: Record<string, VerdictStatus> = {
          'ACCEPTED': 'AC',
          'WRONG ANSWER': 'WA',
          'TIME LIMIT EXCEEDED': 'TLE',
          'OUTPUT LIMIT EXCEEDED': 'TLE',
          'COMPILE ERROR': 'CE',
          'RUNTIME ERROR': 'RE',
        };
        const mappedVerdict: VerdictStatus =
          statusMap[finalResult.status] || (finalResult.status === 'ACCEPTED' ? 'AC' : 'WA');
        const passedCount = finalResult.tests
          ? finalResult.tests.filter((t) => t.verdict === 'ACCEPTED').length
          : finalResult.status === 'ACCEPTED'
          ? 1
          : 0;
        const totalCount = finalResult.tests?.length || 1;
        const maxTimeMs = finalResult.totalTime
          ? Math.round(parseFloat(finalResult.totalTime) * 1000)
          : 10;

        saveSubmission({
          id: `cses-${submitRes.submissionId || Date.now()}`,
          problemId,
          language,
          code,
          charCount: code.length,
          timestamp: Date.now(),
          status: mappedVerdict,
          passedCount,
          totalCount,
          maxTimeMs,
          maxMemoryBytes: 1024 * 1024,
        });
      } catch (saveErr) {
        console.warn('Could not save CSES submission locally:', saveErr);
      }

      if (finalResult.status === 'ACCEPTED' && onAccepted) {
        onAccepted(problemId);
      }
    } catch (err: any) {
      setStage('ERROR');
      setErrorMessage(err?.message || 'Failed to submit to CSES');
      setStage('ERROR');
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
            onClick={onClose}
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
                    Your solution will be judged directly by CSES.fi under the verified bot account <code>csesbetter99</code> (User #520654). No personal CSES credentials required.
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
                      Remember credentials in this browser
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
                    {['POLLING', 'COMPLETED'].includes(stage) ? (
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
                        <span className="text-[10px] opacity-75">{t.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
                onClick={onClose}
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
              onClick={onClose}
              className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl border border-zinc-700 transition-colors"
            >
              Done
            </button>
          )}

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
