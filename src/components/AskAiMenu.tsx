'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { AI_PROVIDERS, buildAiPrompt, type AiProblemContext } from '@/core/ai-prompt';
import type { LanguageId } from '@/core/types';

export function AskAiMenu({ problem, code, language }: { problem: AiProblemContext; code?: string; language?: LanguageId }) {
  const [includeCode, setIncludeCode] = useState(false);
  const [lastProvider, setLastProvider] = useState('');
  const [message, setMessage] = useState('');
  const [manualPrompt, setManualPrompt] = useState('');
  const [position, setPosition] = useState({ left: 12, top: 0, maxHeight: 400 });
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    try { setLastProvider(localStorage.getItem('cses_ai_provider') || ''); } catch {}
    const close = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  useEffect(() => { setMessage(''); setManualPrompt(''); setIncludeCode(false); }, [problem.sourceUrl]);

  const copyAndOpen = (provider: typeof AI_PROVIDERS[number]) => {
    const prompt = buildAiPrompt(problem, includeCode ? code : undefined, language);
    setLastProvider(provider.id);
    try { localStorage.setItem('cses_ai_provider', provider.id); } catch {}
    setManualPrompt('');
    // shortcut: no documented provider prefill contracts; keep native links until browser-verified support exists.
    if (!navigator.clipboard?.writeText) {
      setManualPrompt(prompt);
      setMessage('Copy the prompt below and paste it into the new chat.');
      return;
    }
    navigator.clipboard.writeText(prompt).then(() => {
      setMessage(`Prompt copied—paste it into ${provider.name}.`);
    }).catch(() => {
      setManualPrompt(prompt);
      setMessage('Clipboard access was blocked. Select and copy the prompt below.');
    });
  };

  return <details ref={menu} className="relative shrink-0" onToggle={() => {
    if (!menu.current?.open) return;
    const bounds = menu.current.getBoundingClientRect();
    const width = Math.min(288, innerWidth * 0.85);
    setPosition({ left: Math.max(12, Math.min(bounds.left, innerWidth - width - 12)), top: bounds.bottom + 8, maxHeight: Math.max(100, innerHeight - bounds.bottom - 20) });
  }} onKeyDown={event => {
    if (event.key === 'Escape' && menu.current) { menu.current.open = false; menu.current.querySelector('summary')?.focus(); }
  }}>
    <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-border-muted bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
      Ask AI <ExternalLink className="h-3 w-3" aria-hidden="true" /><ChevronDown className="h-3 w-3" aria-hidden="true" />
    </summary>
    <div style={position} className="fixed z-40 w-72 max-w-[85vw] overflow-y-auto rounded-lg border border-border-muted bg-surface-1 p-3 shadow-xl">
      <p className="mb-3 text-xs leading-5 text-slate-300">Copy a hint-first prompt and open a new AI chat.</p>
      <label className="mb-3 flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={includeCode} disabled={!code?.trim()} onChange={event => setIncludeCode(event.target.checked)} className="accent-sky-500" />Include my code</label>
      <ul className="space-y-1">{[...AI_PROVIDERS].sort((a, b) => Number(b.id === lastProvider) - Number(a.id === lastProvider)).map(provider => <li key={provider.id}><a href={provider.url} target="_blank" rel="noopener noreferrer" onClick={() => copyAndOpen(provider)} className="flex items-center justify-between rounded px-2 py-2 text-sm text-slate-100 hover:bg-surface-2 focus-visible:outline focus-visible:outline-sky-400"><span>{provider.name}{provider.id === lastProvider && <span className="ml-2 text-xs text-slate-400">Last used</span>}</span><ExternalLink className="h-3.5 w-3.5" aria-label="Opens a new tab" /></a></li>)}</ul>
      <p role="status" className="mt-2 text-xs leading-5 text-sky-300">{message}</p>
      {manualPrompt && <label className="mt-2 block text-xs text-slate-200">Prompt<textarea readOnly value={manualPrompt} onFocus={event => event.target.select()} className="mt-1 h-40 w-full resize-y rounded border border-border-muted bg-surface-0 p-2 text-xs text-slate-100" /></label>}
    </div>
  </details>;
}
