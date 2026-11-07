'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Problem, ProblemList } from '@/core/types';
import { getProblemLists, importGuestLists, saveProblemLists } from '@/core/storage';
import { syncProblemLists } from '@/core/list-sync';
import { zcoRoadmap } from '@/data/roadmaps';
import type { ContestProblem } from '@/core/contest-types';

export function ListsModal({ open, onClose, owner, problems, contestProblems = [], solved, onSelect, onToggleSolved, currentProblemId }: { open: boolean; onClose: () => void; owner?: string; problems: Problem[]; contestProblems?: ContestProblem[]; solved: Set<string>; onSelect: (id: string) => void; onToggleSolved: (id: string) => void; currentProblemId?: string }) {
  const key = owner || 'guest';
  const dialogRef = useRef<HTMLDivElement>(null);
  const [lists, setLists] = useState<ProblemList[]>([]);
  const [selected, setSelected] = useState(zcoRoadmap.id);
  const [name, setName] = useState('');
  const [rename, setRename] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [recovered, setRecovered] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (owner) importGuestLists(owner);
    const refresh = () => setLists(getProblemLists(key));
    const changed = () => { refresh(); setRetry(n => n + 1); };
    const recoveredNotice = () => setRecovered(true);
    refresh();
    window.addEventListener('storage', changed);
    window.addEventListener('cses-lists-changed', changed);
    window.addEventListener('cses-lists-refreshed', refresh);
    window.addEventListener('cses-lists-recovered', recoveredNotice);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('cses-lists-changed', changed); window.removeEventListener('cses-lists-refreshed', refresh); window.removeEventListener('cses-lists-recovered', recoveredNotice); };
  }, [key, owner]);
  useEffect(() => {
    if (!owner) { setStatus('Saved on this device'); return; }
    let active = true;
    setStatus('Syncing…');
    const timer = setTimeout(async () => {
      const ok = await syncProblemLists(owner);
      if (active) setStatus(ok ? 'Synced' : 'Saved locally · sync failed');
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [owner, retry]);
  useEffect(() => { const online = () => setRetry(n => n + 1); window.addEventListener('online', online); return () => window.removeEventListener('online', online); }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => previous?.focus();
  }, [open]);
  const visible = lists.filter(list => !list.deleted);
  const active = visible.find(list => list.id === selected);
  useEffect(() => { setRename(active?.name || ''); }, [active?.id, active?.name]);
  const byId = useMemo(() => new Map(problems.map(problem => [problem.id, problem])), [problems]);
  const contestById = useMemo(() => new Map(contestProblems.map(problem => [problem.id, problem])), [contestProblems]);
  const update = (next: ProblemList[]) => saveProblemLists(next, key);
  const edit = (id: string, changes: Partial<ProblemList>) => update(getProblemLists(key).map(list => list.id === id ? { ...list, ...changes, dirty: true } : list));
  const create = () => { const title = name.trim(); if (!title || title.length > 120) return; const id = crypto.randomUUID(); update([...getProblemLists(key), { id, name: title, problemIds: currentProblemId ? [currentProblemId] : [], revision: 0, dirty: true, deleted: false }]); setName(''); setSelected(id); };
  if (!open) return null;
  const sections = active ? [{ name: active.name, problemIds: active.problemIds }] : zcoRoadmap.sections;
  const matches = search.trim() ? problems.filter(p => `${p.id} ${p.title}`.toLowerCase().includes(search.toLowerCase())).slice(0, 30) : [];
  const contestMatches = search.trim() ? contestProblems.filter(p => `${p.id} ${p.contestId} ${p.year} ${p.round} ${p.taskId} ${p.title} ${p.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())).slice(0, 30) : [];
  return <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3" onMouseDown={onClose}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="lists-title" className="w-full max-w-5xl max-h-[90vh] bg-surface-1 border border-border-muted rounded-lg flex flex-col overflow-hidden" onMouseDown={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Tab') { const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') || []); const index = items.indexOf(document.activeElement as HTMLElement); if (items.length && (e.shiftKey ? index <= 0 : index === items.length - 1)) { e.preventDefault(); items[e.shiftKey ? items.length - 1 : 0].focus(); } } }}>
      <header className="flex items-center justify-between gap-3 p-4 border-b border-border-subtle"><div><h2 id="lists-title" className="font-semibold text-lg">Problem lists</h2><p className="text-xs text-text-muted" role="status">{status} {owner && <button className="text-accent underline" onClick={() => setRetry(n => n + 1)}>Retry sync</button>}</p></div><button onClick={onClose} aria-label="Close lists" className="px-3 py-2 text-text-secondary hover:bg-surface-2">?</button></header>
      {recovered && <p role="status" className="px-4 py-2 text-sm text-amber-300">A concurrent edit was saved as a recovered list.</p>}
      <div className="flex-1 overflow-y-auto grid md:grid-cols-[220px_1fr] min-h-0"><aside className="p-4 border-b md:border-b-0 md:border-r border-border-subtle space-y-3"><button onClick={() => setSelected(zcoRoadmap.id)} className={`block text-left w-full px-3 py-2 rounded ${selected === zcoRoadmap.id ? 'bg-surface-3 text-text-primary' : 'text-text-secondary hover:bg-surface-2'}`}>{zcoRoadmap.name}</button>{visible.map(list => <button key={list.id} onClick={() => setSelected(list.id)} className={`block text-left w-full px-3 py-2 rounded break-words ${selected === list.id ? 'bg-surface-3 text-text-primary' : 'text-text-secondary hover:bg-surface-2'}`}>{list.name}</button>)}<form onSubmit={e => { e.preventDefault(); create(); }} className="space-y-2"><label htmlFor="list-name" className="text-xs text-text-muted">New list name</label><input id="list-name" value={name} maxLength={120} onChange={e => setName(e.target.value)} className="w-full bg-surface-0 border border-border-muted rounded p-2 text-sm" /><button disabled={!name.trim()} className="w-full bg-accent text-accent-foreground disabled:opacity-40 rounded px-3 py-2 text-sm">Create list{currentProblemId ? ' with this problem' : ''}</button></form></aside>
      <div className="p-4 space-y-5 min-w-0">{active ? <><div className="flex flex-wrap gap-2 items-end"><form onSubmit={e => { e.preventDefault(); if (rename.trim()) edit(active.id, { name: rename.trim() }); }} className="flex gap-2 items-end"><label className="text-xs text-text-muted">List name<input aria-label="Rename list" value={rename} maxLength={120} onChange={e => setRename(e.target.value)} className="block bg-surface-0 border border-border-muted rounded p-2 mt-1 text-sm text-text-primary" /></label><button disabled={!rename.trim() || rename.trim() === active.name} className="px-3 py-2 text-sm border border-border-muted rounded disabled:opacity-40">Rename</button></form><button onClick={() => { if (window.confirm(`Delete “${active.name}”?`)) { edit(active.id, { deleted: true }); setSelected(zcoRoadmap.id); } }} className="px-3 py-2 text-sm text-rose-300 border border-border-muted rounded">Delete list</button></div>
      {currentProblemId && <button onClick={() => edit(active.id, { problemIds: [...new Set([...active.problemIds, currentProblemId])] })} disabled={active.problemIds.includes(currentProblemId)} className="rounded bg-accent px-3 py-2 text-sm disabled:opacity-40">Add current problem</button>}
      <label className="block text-xs text-text-muted">Add a CSES or Olympiad task<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, contest, year, or task ID" className="block w-full bg-surface-0 border border-border-muted rounded p-2 mt-1 text-sm text-text-primary" /></label>{matches.length > 0 && <div className="max-h-40 overflow-auto border border-border-subtle">{matches.map(p => <button key={p.id} disabled={active.problemIds.includes(p.id)} onClick={() => { edit(active.id, { problemIds: [...active.problemIds, p.id] }); setSearch(''); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-40">CSES #{p.id} {p.title}</button>)}</div>}{contestMatches.length > 0 && <div className="max-h-48 overflow-auto border border-border-subtle">{contestMatches.map(p => <button key={p.id} disabled={active.problemIds.includes(p.id)} onClick={() => { edit(active.id, { problemIds: [...active.problemIds, p.id] }); setSearch(''); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-40">{p.contestId.toUpperCase()} · {p.year} · {p.round} · {p.taskId}: {p.title}</button>)}</div>}</> : <div><h3 className="font-semibold text-lg">{zcoRoadmap.name}</h3><p className="text-sm text-text-muted">{zcoRoadmap.description}</p><p className="mt-2 text-sm text-text-secondary">{zcoRoadmap.sections.flatMap(section => section.problemIds).filter(id => solved.has(id)).length}/80 solved</p></div>}
      {sections.map(section => <section key={section.name}><h4 className="font-semibold text-sm mb-2">{section.name} <span className="font-normal text-text-muted">{section.problemIds.filter(id => solved.has(id)).length}/{section.problemIds.length} solved</span></h4>{section.problemIds.length === 0 && <p className="text-sm text-text-muted">No problems yet.</p>}<ul className="divide-y divide-border-subtle border-t border-border-subtle">{section.problemIds.map(id => { const problem = byId.get(id); const contestProblem = contestById.get(id); const title = problem?.title || contestProblem?.title || 'Problem unavailable'; return <li key={id} className="flex items-center gap-2 py-2 text-sm">{problem && <input type="checkbox" checked={solved.has(id)} onChange={() => onToggleSolved(id)} aria-label={`Mark ${title} as ${solved.has(id) ? 'unsolved' : 'solved'}`} className="accent-accent" />}<button className="flex-1 text-left text-text-primary hover:text-accent" onClick={() => { onSelect(id); onClose(); }}>{contestProblem ? `${contestProblem.contestId.toUpperCase()} · ${contestProblem.year} · ${contestProblem.taskId}` : `#${id}`} {title}</button>{active && <button aria-label={`Remove ${title}`} className="text-text-muted hover:text-rose-300 px-2" onClick={() => edit(active.id, { problemIds: active.problemIds.filter(x => x !== id) })}>Remove</button>}</li>; })}</ul></section>)}
      </div></div></div></div>;
}
