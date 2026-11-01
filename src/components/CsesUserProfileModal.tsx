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
  Code2,
  Send,
  Sparkles,
  Info,
} from 'lucide-react';
import { CsesUserProfile } from '@/core/types';

interface CsesUserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNick?: string;
  onSelectProblem?: (problemId: string) => void;
}

const FEATURED_PROFILES = [
  { label: 'rainboy', id: '3628', desc: '#1 Global' },
  { label: 'LuCpp', id: '51394', desc: '#2 Global' },
  { label: 'mitcute', id: '134297', desc: 'Fastest Code' },
  { label: 'tourist', id: '1016', desc: 'Legendary Grandmaster' },
  { label: 'csesbetter99', id: '520654', desc: 'Bot Account' },
];

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
  const [isNumericNotice, setIsNumericNotice] = useState(false);

  const fetchProfile = async (targetNick: string) => {
    if (!targetNick.trim()) return;
    setIsLoading(true);
    setError(null);
    setIsNumericNotice(false);
    try {
      const res = await fetch(`/api/cses/user/${encodeURIComponent(targetNick.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.isNumericRequired) {
          setIsNumericNotice(true);
        }
        throw new Error(data.error || 'User not found on CSES');
      }
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
        setIsNumericNotice(false);
      }
    }
  }, [isOpen, initialNick]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-zinc-100 flex items-center gap-2">
                CSES User Profile Explorer
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Live Sync
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Inspect official solve records, language statistics, and solved problem archive
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

        {/* Search Bar & Quick Picks */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 space-y-3">
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
                placeholder="Enter CSES User ID (e.g. 134297) or Nickname (e.g. rainboy)..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !nickInput.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Inspect'}
            </button>
          </form>

          {/* Featured Hall of Fame Quick Links */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-medium">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Popular:
            </span>
            {FEATURED_PROFILES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setNickInput(f.id);
                  fetchProfile(f.id);
                }}
                className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-amber-300 border border-zinc-700/60 transition-all font-mono"
                title={`${f.label} - ${f.desc} (ID: ${f.id})`}
              >
                {f.label} <span className="text-zinc-500 text-[10px]">#{f.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col gap-2 text-red-400 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
              {isNumericNotice && (
                <div className="mt-1 p-2.5 bg-zinc-800/80 rounded-lg text-zinc-300 border border-zinc-700/60 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    CSES profile URLs always use a numeric ID (e.g.{' '}
                    <code className="text-amber-300">https://cses.fi/user/134297</code>). You can
                    find a user&apos;s ID directly in the browser address bar when viewing their
                    profile on CSES, or click any user directly in our Leaderboard tab!
                  </p>
                </div>
              )}
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-xs">Fetching profile &amp; solved archive from cses.fi...</p>
            </div>
          )}

          {!isLoading && profile && (
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-800/60 border border-zinc-700/60 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-2xl shrink-0">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-lg text-zinc-100">{profile.nick}</h4>
                      {profile.userId && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                          ID: #{profile.userId}
                        </span>
                      )}
                      {profile.name && (
                        <span className="text-xs font-normal text-zinc-400">
                          ({profile.name})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-zinc-400 flex-wrap">
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
                      {profile.firstSubmission && (
                        <span className="text-[11px] text-zinc-500 font-mono">
                          First: {profile.firstSubmission.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {profile.userId && (
                    <a
                      href={`https://cses.fi/problemset/user/${profile.userId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg border border-zinc-700 text-xs font-medium transition-colors flex items-center gap-1.5"
                      title="Open Official CSES Problemset Solved List"
                    >
                      <span>Problemset</span>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    </a>
                  )}
                  <a
                    href={profile.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg border border-zinc-700 transition-colors"
                    title="Open CSES Account Profile"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Stats overview cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-zinc-800/40 border border-zinc-800 rounded-xl">
                  <div className="text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Solved Problems</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-400 font-mono">
                    {profile.solvedCount}
                    <span className="text-xs font-normal text-zinc-500 ml-1">/ 400</span>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-800/40 border border-zinc-800 rounded-xl">
                  <div className="text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-sky-400" />
                    <span>Total Submissions</span>
                  </div>
                  <div className="text-2xl font-bold text-sky-400 font-mono">
                    {profile.submissionCount !== undefined
                      ? profile.submissionCount.toLocaleString()
                      : profile.solvedCount}
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-800/40 border border-zinc-800 rounded-xl col-span-2 sm:col-span-1">
                  <div className="text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Primary Language</span>
                  </div>
                  <div className="text-lg font-bold text-zinc-100 font-mono truncate">
                    {profile.languages && profile.languages.length > 0
                      ? `${profile.languages[0].language} (${profile.languages[0].share})`
                      : 'None'}
                  </div>
                </div>
              </div>

              {/* Languages Breakdown */}
              {profile.languages && profile.languages.length > 0 && (
                <div className="p-4 bg-zinc-800/30 border border-zinc-800 rounded-xl space-y-2.5">
                  <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Language Distribution
                  </h5>
                  <div className="space-y-2">
                    {profile.languages.map((l) => (
                      <div key={l.language} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-zinc-200">{l.language}</span>
                          <span className="text-zinc-400 text-[11px] font-mono">
                            {l.submissions.toLocaleString()} submissions ({l.share})
                          </span>
                        </div>
                        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all"
                            style={{ width: l.share }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Solved Problems Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Solved Tasks ({profile.solvedProblems.length})
                  </h5>
                  <span className="text-[11px] text-zinc-500">
                    Click any task to load into editor
                  </span>
                </div>

                {profile.solvedProblems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500 bg-zinc-800/30 rounded-xl border border-zinc-800">
                    No solved tasks recorded yet on CSES Problem Set.
                  </div>
                ) : (
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
                        className="p-2.5 bg-zinc-800/60 hover:bg-zinc-700/80 border border-zinc-700/50 rounded-lg text-left transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <span className="text-xs text-zinc-200 group-hover:text-amber-400 transition-colors truncate">
                          {prob.name}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400 shrink-0 ml-2">
                          #{prob.id}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!isLoading && !profile && !error && (
            <div className="text-center py-12 text-zinc-500 text-xs space-y-1">
              <p>Search for any CSES User ID or Handle above, or pick one of the featured solvers.</p>
              <p className="text-[11px] text-zinc-600">
                Official profile statistics and solved problem sets will load instantly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
