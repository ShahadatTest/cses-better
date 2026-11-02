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
  Clock,
  Zap,
} from 'lucide-react';
import { CsesUserProfile, ProblemStats } from '@/core/types';
import { getStoredCsesSessionCookie } from '@/core/cses-client';

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

  // Inspector for specific solved problem stats
  const [inspectedProblem, setInspectedProblem] = useState<{ id: string; name: string } | null>(null);
  const [problemStats, setProblemStats] = useState<ProblemStats | null>(null);
  const [isLoadingProblemStats, setIsLoadingProblemStats] = useState(false);

  const fetchProfile = async (targetNick: string) => {
    if (!targetNick.trim()) return;
    setIsLoading(true);
    setError(null);
    setIsNumericNotice(false);
    setInspectedProblem(null);
    try {
      const headers: Record<string, string> = {};
      const session = getStoredCsesSessionCookie();
      if (session) {
        headers['x-cses-session'] = session;
      }
      const res = await fetch(`/api/cses/user/${encodeURIComponent(targetNick.trim())}`, { headers });
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

  const handleInspectProblem = async (prob: { id: string; name: string }) => {
    setInspectedProblem(prob);
    setIsLoadingProblemStats(true);
    try {
      const res = await fetch(`/api/cses/stats/${prob.id}`);
      if (res.ok) {
        const data = await res.json();
        setProblemStats(data.stats || null);
      }
    } catch (err) {
      console.warn('Failed to load problem stats:', err);
    } finally {
      setIsLoadingProblemStats(false);
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
        setInspectedProblem(null);
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
                  Live CSES Standings
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Inspect official solver achievements, verified solve grids, and benchmark times
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
        <div className="p-6 border-b border-zinc-800 bg-zinc-950/40 space-y-3 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchProfile(nickInput);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={nickInput}
                onChange={(e) => setNickInput(e.target.value)}
                placeholder="Search by CSES numeric User ID (e.g. 134297) or handle (e.g. mitcute)..."
                className="w-full pl-10 pr-4 py-2 bg-zinc-800/80 border border-zinc-700 rounded-xl text-sm font-mono text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-amber-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !nickInput.trim()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold rounded-xl text-sm shadow transition-all flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Inspect'}
            </button>
          </form>

          {/* Quick Picks */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mr-1">
              Popular:
            </span>
            {FEATURED_PROFILES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setNickInput(item.id);
                  fetchProfile(item.id);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-amber-300 border border-zinc-700/60 transition-colors"
                title={`${item.label} (#${item.id}) - ${item.desc}`}
              >
                <span>{item.label}</span>
                <span className="text-[10px] text-zinc-500">#{item.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-red-300">Inspection Notice</p>
                <p className="mt-0.5">{error}</p>
                {isNumericNotice && (
                  <p className="mt-2 text-[11px] text-zinc-400 border-t border-red-500/20 pt-2">
                    💡 Tip: When viewing the leaderboard or problem stats, clicking on any solver automatically resolves their exact numeric ID!
                  </p>
                )}
              </div>
            </div>
          )}

          {profile && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Profile Card */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-zinc-800/40 border border-zinc-700/60 rounded-xl">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xl shadow-inner">
                    {profile.nick ? profile.nick[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-lg text-zinc-100 font-mono">
                        {profile.nick}
                      </h4>
                      {profile.userId && (
                        <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                          #{profile.userId}
                        </span>
                      )}
                    </div>
                    {profile.name && (
                      <p className="text-xs text-zinc-400 font-medium">{profile.name}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400 flex-wrap">
                      {profile.country && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-zinc-500" />
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
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition-colors"
                >
                  <span>Official Page</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Stats Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-zinc-800/40 border border-zinc-800 rounded-xl">
                  <div className="text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Solved Problems</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-400 font-mono">
                    {profile.solvedCount}
                    <span className="text-xs text-zinc-500 font-normal ml-1">/ 400</span>
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

              {/* Solved Problems Grid with Official CSES Inspector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Solved Tasks ({profile.solvedProblems.length})
                  </h5>
                  <span className="text-[11px] text-zinc-500">
                    Click task to inspect official CSES stats or load in editor
                  </span>
                </div>

                {/* Inspected Problem Card (if selected) */}
                {inspectedProblem && (
                  <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-amber-200">
                          {inspectedProblem.name} (#{inspectedProblem.id})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {onSelectProblem && (
                          <button
                            onClick={() => {
                              onSelectProblem(inspectedProblem.id);
                              onClose();
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-lg text-xs transition-colors"
                          >
                            Open in Editor
                          </button>
                        )}
                        <button
                          onClick={() => setInspectedProblem(null)}
                          className="p-1 text-zinc-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {isLoadingProblemStats ? (
                      <div className="flex items-center gap-2 text-xs text-zinc-400 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span>Fetching official CSES problem benchmarks...</span>
                      </div>
                    ) : problemStats ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 bg-zinc-900/60 rounded-lg border border-zinc-800">
                          <span className="text-zinc-500 block text-[10px]">Solved By</span>
                          <span className="font-mono font-bold text-zinc-200">
                            {problemStats.solvedBy.toLocaleString()}
                          </span>
                        </div>
                        <div className="p-2 bg-zinc-900/60 rounded-lg border border-zinc-800">
                          <span className="text-zinc-500 block text-[10px]">Success Rate</span>
                          <span className="font-mono font-bold text-amber-400">
                            {problemStats.successRate}
                          </span>
                        </div>
                        <div className="p-2 bg-zinc-900/60 rounded-lg border border-zinc-800">
                          <span className="text-zinc-500 block text-[10px]">Fastest Record</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {problemStats.fastest?.[0]?.score || '0.00 s'}
                          </span>
                        </div>
                        <div className="p-2 bg-zinc-900/60 rounded-lg border border-zinc-800">
                          <span className="text-zinc-500 block text-[10px]">Golf Record</span>
                          <span className="font-mono font-bold text-sky-400">
                            {problemStats.shortest?.[0]?.score || '—'}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {profile.solvedProblems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500 bg-zinc-800/30 rounded-xl border border-zinc-800">
                    No solved tasks recorded yet on CSES Problem Set.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {profile.solvedProblems.map((prob) => (
                      <div
                        key={prob.id}
                        onClick={() => handleInspectProblem(prob)}
                        className={`p-2.5 bg-zinc-800/60 hover:bg-zinc-700/80 border rounded-lg text-left transition-colors flex items-center justify-between group cursor-pointer ${
                          inspectedProblem?.id === prob.id ? 'border-amber-500/50 bg-zinc-800' : 'border-zinc-700/50'
                        }`}
                      >
                        <span className="text-xs text-zinc-200 group-hover:text-amber-400 transition-colors truncate">
                          {prob.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400">
                            #{prob.id}
                          </span>
                          <Zap className="w-3 h-3 text-zinc-600 group-hover:text-amber-400 transition-colors" />
                        </div>
                      </div>
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
