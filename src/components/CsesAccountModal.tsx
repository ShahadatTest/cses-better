'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  LogOut,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Trophy,
  LockOpen,
} from 'lucide-react';
import {
  getStoredCsesCredentials,
  clearStoredCsesCredentials,
  syncCsesAccount,
} from '@/core/cses-client';
import { StoredCsesAccount } from '@/core/types';

export interface CsesAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSolvesSynced?: (solvedIds: string[]) => void;
}

export function CsesAccountModal({
  isOpen,
  onClose,
  onSolvesSynced,
}: CsesAccountModalProps) {
  const [account, setAccount] = useState<StoredCsesAccount | null>(null);
  const [nick, setNick] = useState('');
  const [pass, setPass] = useState('');
  const [remember, setRemember] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredCsesCredentials();
      setAccount(stored);
      if (stored) {
        setNick(stored.nick);
        setPass('');
        setRemember(stored.remember === true);
      } else {
        setRemember(false);
      }
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnectAndSync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nick.trim()) {
      setErrorMessage('Please enter your CSES nickname');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await syncCsesAccount({
        nick: nick.trim(),
        pass: pass.trim(),
        remember,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to authenticate and sync with CSES');
        setIsLoading(false);
        return;
      }

      const updated = getStoredCsesCredentials();
      setAccount(updated);

      if (res.solvedProblemIds && onSolvesSynced) {
        onSolvesSynced(res.solvedProblemIds);
      }

      setSuccessMessage(
        `Successfully synced ${res.solvedCount ?? res.solvedProblemIds?.length ?? 0} solved problems from official CSES!`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error connecting to CSES');
    } finally {
      setPass('');
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearStoredCsesCredentials();
    void fetch('/api/cses/disconnect', { method: 'POST' }).catch(() => {});
    setAccount(null);
    setNick('');
    setPass('');
    setSuccessMessage('CSES account disconnected.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-zinc-100 flex items-center gap-2">
                Official CSES Account
              </h3>
              <p className="text-xs text-zinc-400">
                Sync completed problems &amp; unlock queues
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
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl flex items-start gap-2.5 text-red-400 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-start gap-2.5 text-emerald-400 text-xs leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {account?.userId ? (
            /* CONNECTED STATE */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      Connected to CSES
                    </span>
                  </div>
                  <a
                    href={`https://cses.fi/user/${account.userId}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-zinc-400 hover:text-amber-400 inline-flex items-center gap-1"
                  >
                    <span>#{account.userId}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-lg font-bold text-zinc-100 font-mono">
                      {account.nick}
                    </div>
                    <div className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>{account.solvedCount ?? 0} problems solved on CSES</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleConnectAndSync()}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                    title="Sync latest completed problems from CSES"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Sync Solves</span>
                  </button>
                </div>
              </div>

              {/* Unlocked Capabilities */}
              <div className="p-3.5 rounded-xl bg-zinc-800/30 border border-zinc-800/80 text-xs text-zinc-300 space-y-2">
                <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <LockOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Unlocked Capabilities</span>
                </div>
                <ul className="space-y-1.5 text-zinc-400 pl-4 list-disc text-[11px]">
                  <li>Live CSES submission queues unlocked for all problems you solved.</li>
                  <li>One-click direct submissions to the official judge.</li>
                  <li>CSES session tokens stay in this browser; cloud progress sync is managed by your app account.</li>
                </ul>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect / Reconnect</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* NOT CONNECTED STATE */
            <form onSubmit={handleConnectAndSync} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    CSES Nickname
                  </label>
                  <input
                    type="text"
                    value={nick}
                    onChange={(e) => setNick(e.target.value)}
                    placeholder="e.g. tourist or your cses handle"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:outline-none text-zinc-100 text-xs placeholder:text-zinc-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    CSES Password
                  </label>
                  <input
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="Your CSES password"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:outline-none text-zinc-100 text-xs placeholder:text-zinc-600 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="rememberCses"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0"
                  />
                  <label htmlFor="rememberCses" className="text-xs text-zinc-400 select-none">
                    Remember this CSES session on this device (optional)
                  </label>
                </div>
              </div>

              <div className="p-3 bg-zinc-800/40 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-zinc-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Why connect your CSES account?</span>
                </div>
                <p>
                  Official CSES rules restrict problem submission queues and hack entry source codes to users who have solved that task. Connecting your account imports your completed problems and unlocks queues for all tasks you have solved.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Authenticating &amp; Syncing...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Connect &amp; Sync Solves</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
