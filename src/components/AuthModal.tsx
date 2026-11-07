'use client';

import React, { useState } from 'react';
import { syncProblemLists } from '@/core/list-sync';
import {
  X,
  LogIn,
  LogOut,
  CheckCircle,
  Cloud,
  AlertCircle,
  User as UserIcon,
  RefreshCw,
  FileText,
  Code2,
} from 'lucide-react';
import { UserProfile } from '@/core/types';
import {
  signInWithGitHub,
  signOutUser,
  isSupabaseConfigured,
  syncAllLocalProgressToCloud,
} from '@/core/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUserChange: (user: UserProfile | null) => void;
  solvedCount: number;
}

export function AuthModal({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  solvedCount,
}: AuthModalProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGitHubLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured) throw new Error('Cloud sign-in is unavailable until Supabase is configured. You can continue as a guest.');

      const { error: err } = await signInWithGitHub();
      if (err) throw err;
    } catch (e: any) {
      setError(e.message || 'Failed to authenticate with GitHub');
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    onUserChange(null);
  };

  const handleManualSync = async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const [res, listsSynced] = await Promise.all([syncAllLocalProgressToCloud(currentUser.id, true), syncProblemLists(currentUser.id)]);
      if (res.success && listsSynced) {
        setSyncMessage(`Synced ${res.syncedSolves} solves, ${res.syncedNotes} notes & lists across devices`);
      } else {
        setError('Partial sync encountered. Local progress preserved.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to sync with cloud');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-zinc-100">
                {currentUser ? 'GitHub Account & Cloud Sync' : 'Sign in to CSES Better'}
              </h3>
              <p className="text-xs text-zinc-400">
                {currentUser
                  ? 'Multi-device continuous progress & notes sync'
                  : 'Sync your notes, drafts, and solved problems across all devices'}
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-red-400 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {syncMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5 text-emerald-400 text-xs leading-relaxed">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{syncMessage}</span>
            </div>
          )}

          {currentUser ? (
            /* Logged in state */
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 bg-zinc-800/60 rounded-xl border border-zinc-700/50">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.displayName || 'User'}
                    className="w-14 h-14 rounded-full border-2 border-blue-500/50 object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xl border border-blue-500/30">
                    <UserIcon className="w-7 h-7" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-zinc-100 text-base truncate">
                      {currentUser.displayName}
                    </h4>
                    {currentUser.username && (
                      <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-mono">
                        @{currentUser.username}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">{currentUser.email || 'GitHub Authenticated'}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Account connected</span>
                  </div>
                </div>
              </div>

              {/* Stats overview */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-zinc-800/40 border border-zinc-800 rounded-xl">
                  <div className="text-2xl font-bold text-blue-400">{solvedCount}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">Problems Solved</div>
                </div>
                <div className="p-3 bg-zinc-800/40 border border-zinc-800 rounded-xl">
                  <div className="text-2xl font-bold text-emerald-400">Cloud</div>
                  <div className="text-xs text-zinc-400 mt-0.5">Notes & Drafts Synced</div>
                </div>
              </div>

              {/* Manual Cloud Sync Trigger */}
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing to Cloud...' : 'Sync Now with Cloud'}
              </button>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl text-xs font-medium border border-zinc-700/60 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            /* Logged out state */
            <div className="space-y-4">
              <div className="space-y-3">
                {/* GitHub Sign-in */}
                <button
                  onClick={handleGitHubLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  {isLoading ? 'Connecting to GitHub...' : 'Continue with GitHub'}
                </button>
              </div>

              <div className="pt-2 text-center text-xs text-zinc-500">
                <span>Practicing offline? </span>
                <button
                  onClick={onClose}
                  className="text-blue-400 hover:underline font-medium"
                >
                  Continue as Guest
                </button>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Guest mode stores drafts in this browser.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
