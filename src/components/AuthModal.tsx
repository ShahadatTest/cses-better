'use client';

import React, { useState } from 'react';
import {
  X,
  LogIn,
  LogOut,
  CheckCircle,
  Cloud,
  AlertCircle,
  User as UserIcon,
  ExternalLink,
} from 'lucide-react';
import { UserProfile } from '@/core/types';
import {
  signInWithGoogle,
  signInWithGitHub,
  signOutUser,
  isSupabaseConfigured,
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
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setError(null);
    setLoadingProvider('google');
    try {
      if (!isSupabaseConfigured) {
        // Guest / Demo simulation if Supabase credentials are not set in environment
        const mockUser: UserProfile = {
          id: `demo-${Date.now()}`,
          displayName: 'Google User',
          email: 'user@gmail.com',
          provider: 'google',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
        };
        onUserChange(mockUser);
        setLoadingProvider(null);
        return;
      }

      const { error: err } = await signInWithGoogle();
      if (err) throw err;
    } catch (e: any) {
      setError(e.message || 'Failed to authenticate with Google');
      setLoadingProvider(null);
    }
  };

  const handleGitHubLogin = async () => {
    setError(null);
    setLoadingProvider('github');
    try {
      if (!isSupabaseConfigured) {
        const mockUser: UserProfile = {
          id: `demo-${Date.now()}`,
          displayName: 'GitHub Developer',
          email: 'dev@github.com',
          provider: 'github',
          avatarUrl: 'https://avatars.githubusercontent.com/u/9919?v=4',
        };
        onUserChange(mockUser);
        setLoadingProvider(null);
        return;
      }

      const { error: err } = await signInWithGitHub();
      if (err) throw err;
    } catch (e: any) {
      setError(e.message || 'Failed to authenticate with GitHub');
      setLoadingProvider(null);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    onUserChange(null);
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
                {currentUser ? 'User Account' : 'Sign in to CSES Better'}
              </h3>
              <p className="text-xs text-zinc-400">
                {currentUser ? 'Manage cloud sync & profile' : 'Sync your drafts and solved status across devices'}
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

          {currentUser ? (
            /* Logged in state */
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 bg-zinc-800/60 rounded-xl border border-zinc-700/50">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.displayName}
                    className="w-14 h-14 rounded-full border-2 border-blue-500/40 object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xl border border-blue-500/30">
                    <UserIcon className="w-7 h-7" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-zinc-100 text-base truncate">
                    {currentUser.displayName}
                  </h4>
                  <p className="text-xs text-zinc-400 truncate">{currentUser.email}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Cloud Sync Active</span>
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
                  <div className="text-2xl font-bold text-emerald-400">100%</div>
                  <div className="text-xs text-zinc-400 mt-0.5">Cloud Backed Up</div>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-sm font-medium border border-zinc-700/60 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          ) : (
            /* Logged out state */
            <div className="space-y-4">
              <div className="space-y-2.5">
                {/* Google Sign-in */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loadingProvider !== null}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-zinc-100 text-zinc-900 rounded-xl font-medium text-sm shadow-sm transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  {loadingProvider === 'google' ? 'Connecting to Google...' : 'Continue with Google'}
                </button>

                {/* GitHub Sign-in */}
                <button
                  onClick={handleGitHubLogin}
                  disabled={loadingProvider !== null}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl font-medium text-sm border border-zinc-700/80 transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  {loadingProvider === 'github' ? 'Connecting to GitHub...' : 'Continue with GitHub'}
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
