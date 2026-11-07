'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  HardDrive,
  FileCode2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Inbox,
  Code2,
  RefreshCw,
  Loader2,
  Eye,
  Globe,
  Laptop,
  Lock,
  KeyRound,
  ExternalLink,
  Search,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { SubmissionRecord, LanguageId, VerdictStatus, CsesSubmissionSummary } from '@/core/types';
import { getStoredCsesSessionCookie, getStoredCsesCredentials } from '@/core/cses-client';
import { getDraft } from '@/core/storage';
import { cn } from '@/lib/utils';
import { CsesCodeViewerModal } from './CsesCodeViewerModal';

export interface SubmissionsTabProps {
  submissions: SubmissionRecord[];
  onSelectCode: (code: string, lang: LanguageId) => void;
  problemId?: string;
  problemTitle?: string;
  onSelectUser?: (nick: string, userId?: string) => void;
  onOpenCsesAccount?: () => void;
  className?: string;
}

function detectLanguageId(langStr?: string): LanguageId {
  if (!langStr) return 'cpp';
  const lower = langStr.toLowerCase();
  if (lower.includes('c++') || lower.includes('cpp')) return 'cpp';
  if (lower.includes('python') || lower.includes('pypy')) return 'python';
  if (lower.includes('java')) return 'java';
  if (lower.includes('rust')) return 'rust';
  if (lower.includes('go')) return 'go';
  if (lower.includes('javascript') || lower.includes('node')) return 'javascript';
  if (lower.includes('typescript')) return 'typescript';
  if (lower === 'c') return 'c';
  return 'cpp';
}

const LANGUAGE_LABELS: Record<string, string> = {
  cpp: 'C++',
  python: 'Python',
  java: 'Java',
  rust: 'Rust',
  go: 'Go',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  c: 'C',
};

function formatTimestamp(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatExactDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

function getStatusConfig(status: VerdictStatus) {
  switch (status) {
    case 'AC':
      return {
        label: 'Accepted',
        code: 'AC',
        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        icon: CheckCircle2,
      };
    case 'WA':
      return {
        label: 'Wrong Answer',
        code: 'WA',
        className: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        icon: XCircle,
      };
    case 'TLE':
      return {
        label: 'Time Limit',
        code: 'TLE',
        className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        icon: Clock,
      };
    case 'MLE':
      return {
        label: 'Memory Limit',
        code: 'MLE',
        className: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        icon: HardDrive,
      };
    case 'CE':
      return {
        label: 'Compile Error',
        code: 'CE',
        className: 'bg-red-500/15 text-red-400 border-red-500/30',
        icon: AlertTriangle,
      };
    case 'RE':
      return {
        label: 'Runtime Error',
        code: 'RE',
        className: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
        icon: AlertTriangle,
      };
    default:
      return {
        label: 'Pending',
        code: 'PENDING',
        className: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
        icon: RotateCcw,
      };
  }
}

export const SubmissionsTab: React.FC<SubmissionsTabProps> = ({
  submissions,
  onSelectCode,
  problemId,
  problemTitle,
  onSelectUser,
  onOpenCsesAccount,
  className,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'cses_queue' | 'local'>('local');
  const [queueSubmissions, setQueueSubmissions] = useState<CsesSubmissionSummary[]>([]);
  const [myCsesSubmissions, setMyCsesSubmissions] = useState<CsesSubmissionSummary[]>([]);
  const [csesAccountInfo, setCsesAccountInfo] = useState<{ nick?: string; userId?: string } | null>(null);
  const [subFilter, setSubFilter] = useState<'all' | 'cses' | 'local'>('all');
  const [loadingCsesId, setLoadingCsesId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [queueCursor, setQueueCursor] = useState<string | null>(null);
  const [queueNotice, setQueueNotice] = useState('');
  const queueController = React.useRef<AbortController | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [selectedCodeEntry, setSelectedCodeEntry] = useState<{
    submissionId?: string;
    solverName?: string;
    language?: string;
    score?: string;
    statusText?: string;
    scoreType?: 'time' | 'size' | 'queue';
    initialCode?: string;
  } | null>(null);

  // Sorting & Filtering State for CSES Queue
  const [filterLang, setFilterLang] = useState<string>('all');
  const [filterVerdict, setFilterVerdict] = useState<string>('all');
  const [searchUser, setSearchUser] = useState<string>('');
  const [sortBy, setSortBy] = useState<'time_desc' | 'time_asc' | 'runtime_asc' | 'size_asc'>('time_desc');

  useEffect(() => {
    const creds = getStoredCsesCredentials();
    if (creds?.nick) {
      setCsesAccountInfo({ nick: creds.nick, userId: creds.userId });
    }
  }, []);

  const fetchQueue = useCallback(async (cursor?: string) => {
    if (!problemId) return;
    queueController.current?.abort();
    const controller = new AbortController();
    queueController.current = controller;
    setIsLoadingQueue(true);
    if (!cursor) { setQueueSubmissions([]); setQueueCursor(null); }
    setQueueNotice('');
    try {
      const sessionCookie = getStoredCsesSessionCookie();
      const headers: Record<string, string> = {};
      if (sessionCookie) {
        headers['x-cses-session'] = sessionCookie;
      }

      const query = new URLSearchParams({ language: filterLang, verdict: filterVerdict, user: searchUser.trim(), sort: sortBy });
      if (cursor) query.set('cursor', cursor);
      const res = await fetch(`/api/cses/submissions/${problemId}?${query}`, { headers, signal: controller.signal });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Could not read CSES submissions.'); }
      if (res.ok) {
        const data = await res.json();
        if (controller.signal.aborted) return;
        setQueueSubmissions(previous => cursor ? [...new Map([...previous, ...(data.submissions || [])].map(row => [row.id, row])).values()] : data.submissions || []);
        setQueueCursor(data.historyCursor || null);
        setQueueNotice(data.historicalCoverage === 'partial' ? 'More historical submissions are available. Load older pages below.' : data.historicalCoverage === 'unavailable' ? 'CSES did not expose the queue. Personal submissions are shown when available.' : '');
        setMyCsesSubmissions(data.mySubmissions || []);
        if (data.currentUser) {
          setCsesAccountInfo(data.currentUser);
        }
        setIsLocked(Boolean(data.isLocked));
        setLockedMessage(data.message || null);
      }
    } catch (err) {
      if (!controller.signal.aborted) setQueueNotice(err instanceof Error ? err.message : 'Could not read CSES submissions.');
    } finally {
      if (!controller.signal.aborted) setIsLoadingQueue(false);
    }
  }, [problemId, filterLang, filterVerdict, searchUser, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => { if (problemId) void fetchQueue(); }, 250);
    return () => { clearTimeout(timer); queueController.current?.abort(); };
  }, [problemId, fetchQueue]);

  const handleLoadCsesSubmission = async (id: string, langName?: string) => {
    setLoadingCsesId(id);
    try {
      const sessionCookie = getStoredCsesSessionCookie();
      const headers: Record<string, string> = {};
      if (sessionCookie) {
        headers['x-cses-session'] = sessionCookie;
      }
      const queryParam = problemId ? `?problemId=${encodeURIComponent(problemId)}` : '';
      const res = await fetch(`/api/cses/result/${id}${queryParam}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.code) {
          const targetLang = detectLanguageId(data.language || langName);
          onSelectCode(data.code, targetLang);
          setLoadedId(id);
          setTimeout(() => setLoadedId(null), 1500);
        }
      }
    } catch (e) {
      console.warn('Failed to load CSES submission code:', e);
    } finally {
      setLoadingCsesId(null);
    }
  };

  const filteredQueue = useMemo(() => {
    let list = [...queueSubmissions];
    if (filterLang !== 'all') {
      list = list.filter((s) => filterLang === 'c' ? /^c(?:$|\s|\d)/i.test(s.language) : s.language?.toLowerCase().includes(filterLang.toLowerCase()));
    }
    if (filterVerdict !== 'all') {
      list = list.filter((s) => filterVerdict === 'FAILED' ? !['ACCEPTED', 'PENDING', 'SKIPPED'].includes(s.status.toUpperCase()) : s.status?.toUpperCase() === filterVerdict.toUpperCase());
    }
    if (searchUser.trim()) {
      const q = searchUser.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.user?.toLowerCase().includes(q) ||
          s.userId?.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'runtime_asc') {
      list.sort((a, b) => {
        const tA = parseFloat(a.runtime || '');
        const tB = parseFloat(b.runtime || '');
        return (Number.isFinite(tA) ? tA : Infinity) - (Number.isFinite(tB) ? tB : Infinity);
      });
    } else if (sortBy === 'size_asc') {
      list.sort((a, b) => {
        const sA = parseInt(a.size?.replace(/\D/g, '') || '999999', 10);
        const sB = parseInt(b.size?.replace(/\D/g, '') || '999999', 10);
        return sA - sB;
      });
    } else if (sortBy === 'time_asc') {
      list.sort((a, b) => a.time.localeCompare(b.time));
    } else {
      list.sort((a, b) => b.time.localeCompare(a.time));
    }
    return list;
  }, [queueSubmissions, filterLang, filterVerdict, searchUser, sortBy]);

  const storedOfficialIds = new Set(submissions.filter(sub => sub.source === 'cses').map(sub => sub.officialSubmissionId));
  const remoteCsesSubmissions = myCsesSubmissions.filter(sub => !storedOfficialIds.has(sub.id));
  const submissionGroups = [
    { source: 'cses', label: 'Saved Official CSES Results', rows: submissions.filter(sub => sub.source === 'cses') },
    { source: 'local', label: 'Local Workbench Runs', rows: submissions.filter(sub => sub.source !== 'cses') },
  ];

  const handleCopyCode = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleLoadCode = (id: string, code: string, lang: LanguageId) => {
    let effectiveCode = code;
    if (!effectiveCode || effectiveCode.trim().length === 0) {
      if (problemId) {
        effectiveCode = getDraft(problemId, lang) || '';
      }
    }
    if (!effectiveCode || effectiveCode.trim().length === 0) {
      return;
    }
    onSelectCode(effectiveCode, lang);
    setLoadedId(id);
    setTimeout(() => setLoadedId(null), 1500);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface-0/60 border border-border-subtle">
          <button
            type="button"
            onClick={() => setActiveSubTab('cses_queue')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
              activeSubTab === 'cses_queue'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
            )}
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>Official CSES Queue</span>
            {queueSubmissions.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/30 text-sky-200 font-mono">
                {queueSubmissions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('local')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
              activeSubTab === 'local'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
            )}
          >
            <Laptop className="w-3.5 h-3.5 text-slate-400" />
            <span>My Submissions & Runs</span>
            {(submissions.length + remoteCsesSubmissions.length) > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-surface-2 text-slate-300 font-mono">
                {submissions.length + remoteCsesSubmissions.length}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => fetchQueue()}
          disabled={isLoadingQueue}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-sky-300 bg-surface-2/60 hover:bg-surface-2 border border-border-subtle transition-colors disabled:opacity-50 cursor-pointer"
          title="Refresh CSES live queue and personal submissions"
        >
          <RefreshCw className={cn('w-3 h-3', isLoadingQueue && 'animate-spin text-sky-400')} />
          <span>Refresh</span>
        </button>
      </div>

      {/* VIEW 1: OFFICIAL CSES QUEUE */}
      {activeSubTab === 'cses_queue' && (
        <div className="space-y-3">
          {/* CSES Queue Sort & Filter Toolbar */}
          {!isLocked && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl border border-border-subtle bg-surface-1/80 text-xs shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                {/* Search solver handle or ID */}
                <div className="relative min-w-[140px] sm:min-w-[170px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Search solver..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Filter Language */}
                <select
                  value={filterLang}
                  onChange={(e) => setFilterLang(e.target.value)}
                  className="bg-surface-2 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="all">All Languages</option>
                  <option value="c++">C++</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="rust">Rust</option>
                  <option value="go">Go</option>
                  <option value="c">C</option>
                  <option value="pascal">Pascal</option>
                </select>

                {/* Filter Verdict */}
                <select
                  value={filterVerdict}
                  onChange={(e) => setFilterVerdict(e.target.value)}
                  className="bg-surface-2 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="all">All Verdicts</option>
                  <option value="ACCEPTED">Accepted (AC)</option>
                  <option value="FAILED">Failed</option>
                </select>

                {/* Sort Option */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-surface-2 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="time_desc">Sort: Newest First</option>
                  <option value="time_asc">Sort: Oldest First</option>
                  <option value="runtime_asc">Sort: Fastest Runtime</option>
                  <option value="size_asc">Sort: Shortest Code</option>
                </select>
              </div>

              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <span>
                  Showing {filteredQueue.length} of {queueSubmissions.length}
                </span>
                {(filterLang !== 'all' || filterVerdict !== 'all' || searchUser.trim() || sortBy !== 'time_desc') && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterLang('all');
                      setFilterVerdict('all');
                      setSearchUser('');
                      setSortBy('time_desc');
                    }}
                    className="text-sky-400 hover:underline cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          )}

          {queueNotice && <p role="status" className="text-xs text-slate-300">{queueNotice}</p>}
          {queueCursor && <button type="button" onClick={() => fetchQueue(queueCursor)} disabled={isLoadingQueue} className="rounded border border-border-muted px-3 py-2 text-xs text-sky-300 disabled:opacity-50">Load more historical submissions</button>}
          {isLoadingQueue ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-3 rounded-xl border border-border-subtle bg-surface-1/40">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span className="text-xs text-slate-400">Fetching live submissions queue from CSES.fi...</span>
            </div>
          ) : queueSubmissions.length === 0 ? (
            isLocked ? (
              <div className="p-8 text-center rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-amber-200">CSES Queue Locked for Task #{problemId}</h4>
                  <p className="text-xs text-zinc-300 max-w-md mx-auto leading-relaxed">
                    {lockedMessage || 'Official CSES rules require solving this problem before viewing other solvers\' submissions.'}
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  {onOpenCsesAccount && (
                    <button
                      type="button"
                      onClick={onOpenCsesAccount}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors shadow-sm cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Connect CSES Account</span>
                    </button>
                  )}
                  <a
                    href={`https://cses.fi/problemset/task/${problemId}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                  >
                    <span>View on CSES.fi</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center rounded-xl border border-border-subtle bg-surface-1/40 space-y-2">
                <Code2 className="w-8 h-8 text-slate-500 mx-auto mb-1 opacity-50" />
                <p className="text-sm font-medium text-slate-200">
                  No submissions found in CSES queue for task #{problemId}.
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Use the "Submit to CSES" action in the editor workbench to submit your code directly to the official CSES judges.
                </p>
              </div>
            )
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-1/60">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-0/40 text-slate-400 font-medium uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3.5">ID</th>
                    <th className="py-2.5 px-3.5">User</th>
                    <th className="py-2.5 px-3.5">Sent At</th>
                    <th className="py-2.5 px-3.5">Language</th>
                    <th className="py-2.5 px-3.5">Runtime</th>
                    <th className="py-2.5 px-3.5">Size</th>
                    <th className="py-2.5 px-3.5">Verdict</th>
                    <th className="py-2.5 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {filteredQueue.map((sub) => {
                    const isOwnSubmission =
                      (csesAccountInfo?.nick && sub.user?.toLowerCase() === csesAccountInfo.nick.toLowerCase()) ||
                      (csesAccountInfo?.userId && sub.userId === csesAccountInfo.userId) ||
                      sub.user === 'You' ||
                      myCsesSubmissions.some((m) => m.id === sub.id);

                    return (
                      <tr
                        key={sub.id}
                        className={cn(
                          'hover:bg-surface-2/30 transition-colors',
                          isOwnSubmission && 'bg-sky-500/10 border-l-2 border-l-sky-400'
                        )}
                      >
                        <td className="py-2.5 px-3.5 font-mono font-medium text-sky-400">
                          #{sub.id}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-1.5">
                            {sub.userId || sub.user ? (
                              <button
                                type="button"
                                onClick={() => onSelectUser?.(sub.user || 'Unknown', sub.userId)}
                                className="text-sky-400 hover:text-sky-300 hover:underline font-mono inline-flex items-center gap-1 font-medium cursor-pointer"
                                title={`Inspect official profile for ${sub.user}`}
                              >
                                <span>{sub.user || 'User'}</span>
                                {sub.userId && (
                                  <span className="text-[10px] text-slate-500 font-normal">
                                    #{sub.userId}
                                  </span>
                                )}
                              </button>
                            ) : (
                              <span className="text-slate-500">Unknown</span>
                            )}
                            {isOwnSubmission && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-400 font-mono text-[11px]">
                          {sub.time}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-2 text-slate-300 border border-border-subtle">
                            {sub.language}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-emerald-400 font-semibold">
                          {sub.runtime || '—'}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-slate-300">
                          {sub.size || '—'}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase border',
                              sub.status === 'ACCEPTED'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            )}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isOwnSubmission && /^\d+$/.test(sub.id) && (
                              <button
                                type="button"
                                onClick={() => handleLoadCsesSubmission(sub.id, sub.language)}
                                disabled={loadingCsesId === sub.id}
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors border cursor-pointer',
                                  loadedId === sub.id
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30'
                                )}
                                title="Load this submission into the editor"
                              >
                                {loadingCsesId === sub.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                                ) : loadedId === sub.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <RotateCcw className="w-3 h-3 text-sky-400" />
                                )}
                                <span>{loadedId === sub.id ? 'Loaded' : 'Load'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCodeEntry({
                                  submissionId: sub.id,
                                  solverName: sub.user || 'CSES Submitter',
                                  language: sub.language,
                                  score: sub.runtime,
                                  statusText: sub.status,
                                  scoreType: 'queue',
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-medium transition-colors cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Code</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: MY SUBMISSIONS & RUNS (OFFICIAL CSES + LOCAL WORKBENCH) */}
      {activeSubTab === 'local' && (
        <div className="space-y-4">
          {/* Sub-filter & CSES Account Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 rounded-xl border border-border-subtle bg-surface-1/60 shadow-xs">
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface-0/60 border border-border-subtle text-xs">
              <button
                type="button"
                onClick={() => setSubFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
                  subFilter === 'all'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                All ({submissions.length + remoteCsesSubmissions.length})
              </button>
              <button
                type="button"
                onClick={() => setSubFilter('cses')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
                  subFilter === 'cses'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Globe className="w-3 h-3 text-sky-400" />
                <span>Official CSES.fi</span>
                <span className="font-mono text-[10px] ml-0.5">({remoteCsesSubmissions.length + submissionGroups[0].rows.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSubFilter('local')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
                  subFilter === 'local'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Laptop className="w-3 h-3 text-slate-400" />
                <span>Local Workbench</span>
                <span className="font-mono text-[10px] ml-0.5">({submissionGroups[1].rows.length})</span>
              </button>
            </div>

            {/* CSES Account badge / trigger */}
            <div className="flex items-center gap-2">
              {csesAccountInfo?.nick ? (
                <button
                  type="button"
                  onClick={onOpenCsesAccount}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 font-mono transition-colors cursor-pointer"
                  title="Click to manage CSES account or sync solves"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>CSES: @{csesAccountInfo.nick}</span>
                </button>
              ) : (
                onOpenCsesAccount && (
                  <button
                    type="button"
                    onClick={onOpenCsesAccount}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Connect CSES Account</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Section 1: Official CSES submissions */}
          {(subFilter === 'all' || subFilter === 'cses') && (
            <div className="space-y-2.5">
              {subFilter === 'all' && myCsesSubmissions.length > 0 && (
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 px-1 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-sky-400" />
                    <span>Official CSES.fi Submissions ({remoteCsesSubmissions.length})</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Recorded on official CSES servers</span>
                </div>
              )}

              {remoteCsesSubmissions.length > 0 ? (
                remoteCsesSubmissions.map((sub) => {
                  const isAc = sub.status === 'ACCEPTED';
                  const isWa = sub.status === 'WRONG ANSWER' || sub.status === 'FAILED';
                  const isTle = sub.status.includes('TIME');

                  return (
                    <div
                      key={sub.id}
                      className="rounded-lg border border-border-subtle bg-surface-1/70 transition-all hover:border-sky-500/40 overflow-hidden shadow-xs"
                    >
                      <div className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                        {/* Left Side: Verdict badge, CSES.fi Official badge, and details */}
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono border',
                              isAc
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : isWa
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : isTle
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-red-500/15 text-red-400 border-red-500/30'
                            )}
                          >
                            {isAc ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            <span>{sub.status}</span>
                          </span>

                          <a
                            href={sub.resultUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition-colors"
                            title="Open submission details on cses.fi"
                          >
                            <Globe className="w-3 h-3 text-sky-400" />
                            <span>CSES.fi Official</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                          </a>

                          <span className="font-mono text-xs font-semibold text-sky-400">
                            #{sub.id}
                          </span>

                          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-2 text-slate-300 border border-border-subtle">
                            {sub.language}
                          </span>
                        </div>

                        {/* Right Side: Runtime, Size, Time, Actions */}
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="font-mono text-emerald-400 font-semibold">
                            {sub.runtime || '—'}
                          </span>
                          {sub.size && (
                            <span className="font-mono text-slate-300">
                              {sub.size}
                            </span>
                          )}
                          <span className="font-mono text-[11px] text-slate-400">
                            {sub.time}
                          </span>

                          {/* Load in Editor Button */}
                          <button
                            type="button"
                            onClick={() => handleLoadCsesSubmission(sub.id, sub.language)}
                            disabled={loadingCsesId === sub.id}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors border cursor-pointer',
                              loadedId === sub.id
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30'
                            )}
                            title="Fetch source code from official CSES and load into editor"
                          >
                            {loadingCsesId === sub.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                                <span>Loading...</span>
                              </>
                            ) : loadedId === sub.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Loaded</span>
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-3 h-3 text-sky-400" />
                                <span>Load in Editor</span>
                              </>
                            )}
                          </button>

                          {/* View Code Button */}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCodeEntry({
                                submissionId: sub.id,
                                solverName: sub.user || (csesAccountInfo?.nick ? `@${csesAccountInfo.nick}` : 'You'),
                                language: sub.language,
                                score: sub.runtime,
                                statusText: sub.status,
                                scoreType: 'queue',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-surface-2 hover:bg-surface-3 text-slate-200 border border-border-subtle transition-colors cursor-pointer"
                            title="Inspect submission source code and verdicts"
                          >
                            <Eye className="w-3 h-3 text-slate-400" />
                            <span>View Code</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : subFilter === 'cses' && storedOfficialIds.size === 0 ? (
                <div className="p-8 text-center rounded-xl border border-border-subtle bg-surface-1/40 space-y-3">
                  <Globe className="w-8 h-8 text-slate-500 mx-auto opacity-50" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-slate-200">No Official CSES.fi Submissions Found</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      {csesAccountInfo?.nick
                        ? `No submissions recorded on cses.fi for task #${problemId} under @${csesAccountInfo.nick}. Submit your solution via "Submit to CSES" to test on official servers.`
                        : 'Connect your official CSES account using the button above to automatically sync and display all submissions you made on cses.fi.'}
                    </p>
                  </div>
                  {onOpenCsesAccount && !csesAccountInfo?.nick && (
                    <button
                      type="button"
                      onClick={onOpenCsesAccount}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors shadow-sm cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Connect CSES Account</span>
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {submissionGroups.filter(group => subFilter === 'all' || subFilter === group.source).map(group => (
            <div key={group.source} className="space-y-2.5">
              {group.rows.length > 0 && (
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 px-1 pt-2">
                  <div className="flex items-center gap-1.5">
                    {group.source === 'cses' ? <Globe className="w-3.5 h-3.5 text-sky-400" /> : <Laptop className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{group.label} ({group.rows.length})</span>
                  </div>
                  <span className="text-[11px] text-slate-500">{group.source === 'cses' ? 'Official judge results saved on this device' : 'In-browser testbench history'}</span>
                </div>
              )}

              {group.rows.length > 0 ? (
                group.rows.map((sub) => {
                  const statusConfig = getStatusConfig(sub.status);
                  const StatusIcon = statusConfig.icon;
                  const isExpanded = expandedId === sub.id;
                  const memoryMb = sub.source === 'cses' && !sub.officialResult?.totalMemory
                    ? '—' : (sub.maxMemoryBytes / (1024 * 1024)).toFixed(1);
                  const langDisplay = LANGUAGE_LABELS[sub.language] || sub.language;

                  return (
                    <div
                      key={sub.id}
                      className="rounded-lg border border-border-subtle bg-surface-1/70 transition-all hover:border-border-muted overflow-hidden shadow-xs"
                    >
                      {/* Header Row */}
                      <div className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                              statusConfig.className
                            )}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            <span>{statusConfig.label}</span>
                          </span>

                          <span className="text-xs text-slate-300 font-medium">
                            {sub.source === 'cses' && !sub.totalCount ? 'Test breakdown unavailable' : `${sub.passedCount} / ${sub.totalCount} passed`}
                          </span>

                          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-2 text-slate-300 border border-border-subtle">
                            {langDisplay}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="font-mono text-emerald-400 font-medium">
                            {sub.source === 'cses' ? (sub.officialResult?.totalTime || '—') : `${sub.maxTimeMs} ms`}
                          </span>
                          <span className="font-mono text-slate-400">
                            {sub.source === 'cses' ? (sub.officialResult?.totalMemory || '—') : `${memoryMb} MB`}
                          </span>
                          {sub.charCount !== undefined && (
                            <span className="font-mono text-slate-400">
                              {sub.charCount} ch.
                            </span>
                          )}
                          <span title={formatExactDate(sub.timestamp)}>
                            {formatTimestamp(sub.timestamp)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleLoadCode(sub.id, sub.code, sub.language)}
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors border cursor-pointer',
                              loadedId === sub.id
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-surface-2 hover:bg-surface-3 text-slate-200 hover:text-white border-border-subtle'
                            )}
                            title="Load this submission's code into the editor"
                          >
                            {loadedId === sub.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Loaded</span>
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-3 h-3 text-sky-400" />
                                <span>Load Code</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                            className="p-1 rounded hover:bg-surface-2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                            title={isExpanded ? 'Collapse code' : 'View code'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Code Body */}
                      {isExpanded && (() => {
                        const effectiveCode = sub.code || (problemId ? getDraft(sub.problemId || problemId, sub.language) : '') || '';
                        const isRestoredDraft = !sub.code && Boolean(effectiveCode);

                        return (
                          <div className="border-t border-border-subtle bg-surface-0/60 p-4 space-y-3">
                            {sub.officialResult && (
                              <section className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                                <div className="flex flex-wrap justify-between gap-2 text-xs">
                                  <strong className="text-emerald-300">Official CSES result · {sub.officialResult.rawStatusText}</strong>
                                  <span className="text-slate-400">Time {sub.officialResult.totalTime || '—'} · Memory {sub.officialResult.totalMemory || '—'}</span>
                                </div>
                                {sub.officialResult.tests.length > 0 && (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                    {sub.officialResult.tests.map((test) => (
                                      <div key={test.index} className="rounded border border-border-subtle bg-surface-0 px-2 py-1 text-[11px] text-slate-300">
                                        #{test.index} {test.verdict} · {test.time || '—'}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {sub.officialResult.tests.some((test) => test.input || test.expectedOutput || test.actualOutput) && (
                                  <div className="space-y-1.5">
                                    {sub.officialResult.tests.filter((test) => test.input || test.expectedOutput || test.actualOutput).map((test) => (
                                      <details key={`official-${test.index}`} className="rounded border border-border-subtle px-2.5 py-2 text-xs">
                                        <summary className="cursor-pointer text-slate-300">Test #{test.index} details shown by CSES</summary>
                                        {[['Input', test.input], ['Expected', test.expectedOutput], ['Your output', test.actualOutput]].map(([label, value]) => value && (
                                          <pre key={label} className="mt-2 whitespace-pre-wrap break-words text-slate-400"><span className="text-slate-200">{label}: </span>{value}</pre>
                                        ))}
                                        {test.detailsUrl && <a href={test.detailsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sky-300 underline">Open CSES test detail</a>}
                                      </details>
                                    ))}
                                  </div>
                                )}
                                {sub.officialResult.compilerOutput && <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-orange-200">{sub.officialResult.compilerOutput}</pre>}
                                <a href={sub.officialResult.resultUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300 underline">Open official CSES result</a>
                              </section>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                                <FileCode2 className="w-3.5 h-3.5 text-sky-400" />
                                <span>Submitted Source Code ({effectiveCode.length} characters)</span>
                                {isRestoredDraft && (
                                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    Draft Code Recovery
                                  </span>
                                )}
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(sub.id, effectiveCode)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-surface-2 hover:bg-surface-3 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  {copiedId === sub.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleLoadCode(sub.id, effectiveCode, sub.language)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>{loadedId === sub.id ? 'Loaded!' : 'Load Code'}</span>
                                </button>
                              </div>
                            </div>

                            <pre className="p-3.5 rounded-lg bg-surface-0 border border-border-subtle font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre leading-relaxed select-all max-h-96">
                              {effectiveCode || '// No source code recorded for this run.'}
                            </pre>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              ) : subFilter === 'local' && group.source === 'local' ? (
                <div className="p-10 text-center rounded-xl border border-border-subtle bg-surface-1/40 space-y-2">
                  <Inbox className="w-8 h-8 text-slate-500 mx-auto mb-1 opacity-50" />
                  <p className="text-sm font-semibold text-slate-200">
                    No Local Workbench Runs
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Run testcases or submit your code in the editor to record local verdicts, memory benchmarks, and diff revisions.
                  </p>
                </div>
              ) : null}
            </div>
          ))}

          {/* Empty state for All Submissions */}
          {subFilter === 'all' && myCsesSubmissions.length === 0 && submissions.length === 0 && (
            <div className="p-10 text-center rounded-xl border border-border-subtle bg-surface-1/40 space-y-3">
              <Inbox className="w-8 h-8 text-slate-500 mx-auto mb-1 opacity-50" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-200">
                  No submissions yet
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Submit code directly via "Submit to CSES" or run your code in the workbench to track testcases and benchmarks.
                </p>
              </div>
              {onOpenCsesAccount && !csesAccountInfo?.nick && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onOpenCsesAccount}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors shadow-sm cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Connect CSES Account</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Code Viewer Modal */}
      {selectedCodeEntry && (
        <CsesCodeViewerModal
          isOpen={Boolean(selectedCodeEntry)}
          onClose={() => setSelectedCodeEntry(null)}
          submissionId={selectedCodeEntry.submissionId}
          solverName={selectedCodeEntry.solverName}
          problemId={problemId}
          problemTitle={problemTitle}
          language={selectedCodeEntry.language}
          score={selectedCodeEntry.score}
          statusText={selectedCodeEntry.statusText}
          scoreType={selectedCodeEntry.scoreType}
          initialCode={selectedCodeEntry.initialCode}
          onLoadIntoEditor={onSelectCode}
        />
      )}
    </div>
  );
};

export default SubmissionsTab;
