'use client';

import { useMemo, useState } from 'react';
import type { ContestProblem, ContestId } from '@/core/contest-types';

const contests: { id: ContestId; name: string }[] = [
  { id: 'zio', name: 'ZIO' }, { id: 'zco', name: 'ZCO' }, { id: 'inoi', name: 'INOI' }, { id: 'usaco', name: 'USACO' },
];

export function ContestBankModal({ open, onClose, onSelect, problems, loading = false }: { open: boolean; onClose: () => void; onSelect: (id: string) => void; problems: ContestProblem[]; loading?: boolean }) {
  const [contest, setContest] = useState<ContestId | 'all'>('all');
  const [year, setYear] = useState('all');
  const [topic, setTopic] = useState('all');
  const [query, setQuery] = useState('');
  const years = useMemo(() => [...new Set(problems.filter(problem => contest === 'all' || problem.contestId === contest).map(problem => problem.year))].sort((a, b) => b - a), [contest, problems]);
  const topics = useMemo(() => [...new Set(problems.filter(problem => contest === 'all' || problem.contestId === contest).flatMap(problem => problem.tags))].sort(), [contest, problems]);
  const visible = useMemo(() => problems.filter(problem => (contest === 'all' || problem.contestId === contest) && (year === 'all' || problem.year === Number(year)) && (topic === 'all' || problem.tags.includes(topic)) && `${problem.title} ${problem.taskId} ${problem.round} ${problem.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => b.year - a.year || a.contestId.localeCompare(b.contestId) || a.round.localeCompare(b.round) || a.taskId.localeCompare(b.taskId)), [contest, problems, query, topic, year]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="contest-bank-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border-muted bg-surface-1" onMouseDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <header className="flex items-start justify-between gap-4 border-b border-border-subtle p-4 sm:p-5"><div><h2 id="contest-bank-title" className="text-lg font-semibold text-white">Olympiad question bank</h2><p className="mt-1 text-sm text-text-muted">Browse archived problems by contest, year, and topic. Each task opens in an independent workspace.</p></div><button type="button" onClick={onClose} aria-label="Close question bank" className="rounded px-2 py-1 text-text-secondary hover:bg-surface-2">✕</button></header>
      <div className="grid gap-2 border-b border-border-subtle p-4 sm:grid-cols-[1fr_1fr_1fr_2fr]">
        <label className="text-xs text-text-muted">Contest<select value={contest} onChange={event => { setContest(event.target.value as ContestId | 'all'); setYear('all'); setTopic('all'); }} className="mt-1 block w-full rounded border border-border-muted bg-surface-0 p-2 text-sm text-white"><option value="all">All contests</option>{contests.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs text-text-muted">Year<select value={year} onChange={event => setYear(event.target.value)} className="mt-1 block w-full rounded border border-border-muted bg-surface-0 p-2 text-sm text-white"><option value="all">All years</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-xs text-text-muted">Topic<select value={topic} onChange={event => setTopic(event.target.value)} className="mt-1 block w-full rounded border border-border-muted bg-surface-0 p-2 text-sm text-white"><option value="all">All topics</option>{topics.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-xs text-text-muted">Search<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Problem title or task" className="mt-1 block w-full rounded border border-border-muted bg-surface-0 p-2 text-sm text-white" /></label>
      </div>
      <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
        {problems.length === 0 && loading ? <p role="status" className="py-10 text-center text-sm text-text-muted">Loading the verified contest catalog…</p> : problems.length === 0 ? <div className="py-10 text-center"><p className="font-medium text-text-primary">Contest catalog unavailable.</p><p className="mt-2 text-sm text-text-muted">Close and reopen the bank to retry.</p></div> : visible.length === 0 ? <p className="py-10 text-center text-sm text-text-muted">No tasks match these filters.</p> : <><p className="mb-3 text-xs text-text-muted">{visible.length} task{visible.length === 1 ? '' : 's'}</p><ul className="divide-y divide-border-subtle border-y border-border-subtle">{visible.map(problem => <li key={problem.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><button type="button" onClick={() => { onSelect(problem.id); onClose(); }} className="min-w-0 flex-1 text-left"><span className="text-xs font-medium text-accent">{problem.contestId.toUpperCase()} · {problem.year} · {problem.round} · {problem.taskId}</span><span className="mt-0.5 block font-medium text-text-primary">{problem.title}</span><span className="mt-1 block text-xs text-text-muted">{problem.tags.join(' · ')}</span></button><a href={problem.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-text-muted underline underline-offset-2 hover:text-accent">Official source</a></li>)}</ul></>}
      </div>
    </section>
  </div>;
}
