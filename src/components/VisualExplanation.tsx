'use client';

import React from 'react';
import type { ContestVisual } from '@/core/contest-types';
import { KaTeXRenderer } from './KaTeXRenderer';

function Text({ children }: { children: string }) {
  return <KaTeXRenderer content={children.replace(/\n/g, '<br />')} />;
}

function Diagram({ value }: { value: Record<string, unknown> }) {
  if (value.type === 'sequence' && Array.isArray(value.items)) {
    const emphasized = new Set(Array.isArray(value.emphasisIndices) ? value.emphasisIndices as number[] : []);
    return <div className="flex flex-wrap items-center gap-2" aria-label="State sequence">{value.items.map((item, index) => <span key={index} className="contents">{index > 0 && <span aria-hidden="true" className="text-text-muted">→</span>}<span className={`rounded-md border px-3 py-2 font-mono text-sm ${emphasized.has(index) ? 'border-accent bg-accent/10 text-accent' : 'border-border-muted bg-surface-0 text-text-primary'}`}>{String(item)}</span></span>)}</div>;
  }
  if ((value.type === 'table' || value.type === 'grid') && Array.isArray(value.rows ?? value.cells)) {
    const rows = (value.rows ?? value.cells) as unknown[][];
    const columns = Array.isArray(value.columns) ? value.columns : [];
    const path = new Set(Array.isArray(value.path) ? (value.path as unknown[]).filter(Array.isArray).map(cell => `${cell[0]},${cell[1]}`) : []);
    return <div className="overflow-x-auto"><table className="border-collapse text-center text-sm"><caption className="sr-only">{value.type === 'grid' ? 'Problem grid; highlighted cells show the illustrated path' : 'State table'}</caption>{columns.length > 0 && <thead><tr>{columns.map((column, index) => <th key={index} className="border border-border-muted px-3 py-2 text-text-muted">{String(column)}</th>)}</tr></thead>}<tbody>{rows.map((row, r) => <tr key={r}>{(row as unknown[]).map((cell, c) => <td key={c} className={`min-w-10 border border-border-muted px-3 py-2 font-mono ${path.has(`${r},${c}`) ? 'bg-accent/20 text-accent' : 'bg-surface-0 text-text-primary'}`}>{String(cell)}</td>)}</tr>)}</tbody></table></div>;
  }
  if ((value.type === 'graph' || value.type === 'tree') && Array.isArray(value.nodes) && Array.isArray(value.edges)) {
    const nodes = value.nodes.filter((node: any) => node && typeof node.id === 'string' && typeof node.label === 'string' && Number.isFinite(node.x) && Number.isFinite(node.y) && node.x >= 0 && node.x <= 100 && node.y >= 0 && node.y <= 100);
    const nodeIds = new Set(nodes.map((node: any) => node.id));
    const edges = value.edges.filter((edge: any) => edge && nodeIds.has(edge.from) && nodeIds.has(edge.to));
    return <svg viewBox="0 0 100 100" role="img" aria-label={value.type === 'tree' ? 'Tree diagram' : 'Graph diagram'} className="mx-auto block h-48 w-full max-w-md overflow-visible">
      {edges.map((edge: any, index: number) => { const from = nodes.find((node: any) => node.id === edge.from)!; const to = nodes.find((node: any) => node.id === edge.to)!; return <g key={index}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgb(100 116 139)" strokeWidth="1.2" />{edge.label && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 2} fill="rgb(203 213 225)" fontSize="4" textAnchor="middle">{edge.label}</text>}</g>; })}
      {nodes.map((node: any) => <g key={node.id}><circle cx={node.x} cy={node.y} r="6" fill="rgb(15 23 42)" stroke="rgb(56 189 248)" strokeWidth="1.2" /><text x={node.x} y={node.y + 1.5} fill="rgb(241 245 249)" fontSize="4" textAnchor="middle">{node.label}</text></g>)}
    </svg>;
  }
  if (Array.isArray(value.nodes) && Array.isArray(value.edges)) {
    const nodes = value.nodes.filter((node: any) => node && typeof node.id === 'string' && typeof node.label === 'string');
    const edges = value.edges as any[];
    return <div className="flex flex-wrap items-center justify-center gap-2">{nodes.map((node: any, index: number) => { const previous = nodes[index - 1]; const edge = previous && edges.find(item => item.from === previous.id && item.to === node.id); return <span key={node.id} className="contents">{index > 0 && <span aria-label={edge?.label || 'leads to'} className="text-xs text-text-muted">{edge?.label || '→'}</span>}<span className="max-w-52 rounded-md border border-border-muted bg-surface-0 px-3 py-2 text-center text-sm text-text-primary"><span className="block font-medium">{node.label}</span>{node.text && <span className="mt-1 block whitespace-pre-wrap font-mono text-xs text-text-muted">{node.text}</span>}</span></span>; })}</div>;
  }
  if (typeof value.formula === 'string' || typeof value.text === 'string') {
    const body = String(value.formula ?? value.text);
    return <div className="rounded-md border border-accent/30 bg-accent/5 p-4 text-center text-base text-accent"><Text>{body}</Text>{typeof value.count === 'string' && <p className="mt-2 text-sm text-text-secondary">{value.count}</p>}</div>;
  }
  if (Array.isArray(value.source) && Array.isArray(value.targetPattern)) {
    return <div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-2 text-xs text-text-muted">Starting values</p><div className="flex flex-wrap gap-2">{value.source.map((item: unknown, index: number) => <span key={index} className="rounded border border-border-muted bg-surface-0 px-3 py-2 font-mono text-sm text-text-primary">{String(item)}</span>)}</div></div><div><p className="mb-2 text-xs text-text-muted">Target pattern</p><div className="flex flex-wrap gap-2">{value.targetPattern.map((item: unknown, index: number) => <span key={index} className="rounded border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-sm text-accent">{String(item)}</span>)}</div></div></div>;
  }
  if (value.type === 'intervals' && Array.isArray(value.items)) {
    const items = value.items.filter((item: any) => item && typeof item.label === 'string' && Number.isFinite(item.start) && Number.isFinite(item.end) && item.start <= item.end);
    const low = Math.min(0, ...items.map((item: any) => item.start)); const high = Math.max(1, ...items.map((item: any) => item.end)); const width = high - low;
    return <div className="space-y-3">{items.map((item: any, index: number) => <div key={index} className="grid grid-cols-[7rem_1fr] items-center gap-3"><span className="truncate text-xs text-text-muted">{item.label}</span><div className="h-7 rounded bg-surface-0"><div className="flex h-full items-center rounded border border-accent/60 bg-accent/15 px-2 text-xs text-accent" style={{ width: `${Math.max(3, (item.end - item.start) / width * 100)}%`, marginLeft: `${(item.start - low) / width * 100}%` }}><span className="truncate">{item.start}–{item.end}</span></div></div></div>)}</div>;
  }
  const entries = Object.entries(value).filter(([key]) => key !== 'type');
  if (!entries.length) return null;
  return <div className="grid gap-3 sm:grid-cols-2">{entries.map(([key, content]) => <div key={key} className="min-w-0 rounded-md border border-border-subtle bg-surface-0 p-3"><h4 className="mb-2 text-xs font-semibold capitalize text-text-muted">{key.replace(/([A-Z])/g, ' $1').replaceAll('-', ' ')}</h4><DiagramValue value={content} /></div>)}</div>;
}

function DiagramValue({ value }: { value: unknown }): JSX.Element {
  if (value === null || value === undefined) return <span className="text-xs text-text-muted">No value</span>;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return <span className="whitespace-pre-wrap font-mono text-sm text-text-primary">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.every(item => !item || ['string', 'number', 'boolean'].includes(typeof item))) return <div className="flex flex-wrap items-center gap-2">{value.map((item, index) => <span key={index} className="contents">{index > 0 && <span aria-hidden="true" className="text-text-muted">→</span>}<span className="rounded border border-border-muted bg-surface-1 px-2.5 py-1.5 font-mono text-xs text-text-primary">{String(item ?? '')}</span></span>)}</div>;
    if (value.every(Array.isArray)) return <div className="overflow-x-auto"><table className="border-collapse text-center text-xs"><tbody>{value.map((row, r) => <tr key={r}>{row.map((cell: unknown, c: number) => <td key={c} className="border border-border-muted bg-surface-1 px-2.5 py-1.5 font-mono text-text-primary">{String(cell)}</td>)}</tr>)}</tbody></table></div>;
    return <ul className="space-y-2">{value.map((item, index) => <li key={index} className="rounded border border-border-muted bg-surface-1 p-2"><DiagramValue value={item} /></li>)}</ul>;
  }
  if (typeof value === 'object') return <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key} className="contents"><dt className="text-text-muted">{key}</dt><dd className="min-w-0 text-text-primary"><DiagramValue value={item} /></dd></div>)}</dl>;
  return <span className="text-xs text-text-muted">Unsupported visual data</span>;
}

export function VisualExplanation({ visual }: { visual: ContestVisual }) {
  const diagram = visual.diagram ? <Diagram value={visual.diagram} /> : null;
  return <section aria-labelledby="lesson-visual-title" className="rounded-lg border border-border-subtle bg-surface-0 p-4 sm:p-5">
    <div className="mb-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-accent">{visual.kind.replaceAll('-', ' ')}</p><h3 id="lesson-visual-title" className="mt-1 text-base font-semibold text-text-primary">{visual.title}</h3><p className="mt-1 text-sm text-text-muted">{visual.caption}</p></div>
    {diagram && <div className="mb-5 overflow-x-auto rounded-md border border-border-subtle bg-surface-1 p-4">{diagram}</div>}
    <ol className="grid gap-3 sm:grid-cols-2">{visual.steps.map((step, index) => <li key={`${step.label}-${index}`} className="rounded-md border border-border-subtle bg-surface-1 p-3"><div className="mb-2 flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">{index + 1}</span><h4 className="font-semibold text-text-primary">{step.label}</h4></div><Text>{step.detail}</Text></li>)}</ol>
  </section>;
}
