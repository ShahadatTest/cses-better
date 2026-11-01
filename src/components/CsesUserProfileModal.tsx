'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Search,
  ExternalLink,
  Award,
  Globe,
  Calendar,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { CsesUserProfile } from '@/core/types';

interface CsesUserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNick?: string;
  onSelectProblem?: (problemId: string) => void;
}

export function CsesUserProfileModal({
  isOpen,
  onClose,
  initialNick = '',
  onSelectProblem,
}: CsesUserProfileModalProps) {
  const [nickInput, setNickInput] = useState(initialNick);
  const [profile, setProfile] = useState<CsesUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (targetNick: string) => {
    if (!targetNick.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cses/user/${encodeURIComponent(targetNick.trim())}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'User not found on CSES');
      }
      const data: CsesUserProfile = await res.json();
      setProfile(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load user profile');
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialNick) {
        setNickInput(initialNick);
        fetchProfile(initialNick);
      } else {
        setProfile(null);
        setError(null);
      }
    }
  }, [isOpen, initialNick]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-zinc-100">CSES User Profile</h3>
              <p className="text-xs text-zinc-400">
                Inspect official statistics and solved tasks
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

        {/* Search Bar */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchProfile(nickInput);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={nickInput}
                onChange={(e) => setNickInput(e.target.value)}
                placeholder="Enter CSES Nickname (e.g. tourist, benq, csesbetter99)..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !nickInput.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </form>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-xs">Fetching profile from cses.fi...</p>
            </div>
          )}

          {!isLoading && profile && (
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="flex items-start justify-between p-4 bg-zinc-800/60 border border-zinc-700/60 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-2xl">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                      {profile.nick}
                      {profile.name && (
                        <span className="text-xs font-normal text-zinc-400">
                          ({profile.name})
                        </span>
                      )}
                    </h4>
                    <div className="flex items-center gap-4 mt-1 text-xs text-zinc-400">
                      {profile.country && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-blue-400" />
                          {profile.country}
                        </span>
                      )}
                      {profile.registeredDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                          Joined {profile.registeredDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <a
                  href={profile.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg border border-zinc-700 transition-colors"
                  title="View on CSES.fi"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* Stats overview */}
              <div className="p-4 bg-zinc-800/40 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-amber-400">{profile.solvedCount}</div>
                  <div className="text-xs text-zinc-400">Total Solved Problems</div>
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  <span>Verified CSES Profile</span>
                </div>
              </div>

              {/* Solved Problems Grid */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Solved Tasks ({profile.solvedProblems.length})
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {profile.solvedProblems.map((prob) => (
                    <button
                      key={prob.id}
                      onClick={() => {
                        if (onSelectProblem) {
                          onSelectProblem(prob.id);
                          onClose();
                        }
                      }}
                      className="p-2.5 bg-zinc-800/60 hover:bg-zinc-700/80 border border-zinc-700/50 rounded-lg text-left transition-colors flex items-center justify-between group"
                    >
                      <span className="text-xs text-zinc-200 group-hover:text-blue-400 transition-colors truncate">
                        {prob.name}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0 ml-2">
                        #{prob.id}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isLoading && !profile && !error && (
            <div className="text-center py-10 text-zinc-500 text-xs">
              Search for any CSES handle above to explore their official solved catalog.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
