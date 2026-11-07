'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ContestProblem } from '@/core/contest-types';
import type { LanguageId } from '@/core/types';
import { getLanguageTemplate } from '@/core/templates';
import { executeCode } from '@/core/compiler';
import { EditorWorkbench } from '@/components/editor/EditorWorkbench';
import { VisualExplanation } from '@/components/VisualExplanation';
import { AskAiMenu } from '@/components/AskAiMenu';
import { getSettings } from '@/core/storage';
import { saveSettings } from '@/core/storage';
import { COMMAND_CATALOG, isDialogOpen, isEditableTarget, isShortcutRecordingTarget, matchesShortcut, resolveShortcutOverrides } from '@/core/commands';
import type { AppSettings } from '@/core/types';
import { CommandPalette } from '@/components/CommandPalette';
import { SettingsModal } from '@/components/SettingsModal';

export function ContestWorkspace({ problem }: { problem: ContestProblem }) {
  const [language, setLanguage] = useState<LanguageId>('cpp');
  const [code, setCode] = useState(() => getLanguageTemplate('cpp'));
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'appearance'|'shortcuts'|undefined>();
  const bindings = useMemo(() => resolveShortcutOverrides(settings.shortcutOverrides), [settings.shortcutOverrides]);
  const draftKey = `olympiad_draft_${problem.id}_`;

  useEffect(() => {
    const saved = localStorage.getItem(`${draftKey}${language}`);
    setCode(saved ?? getLanguageTemplate(language));
  }, [draftKey, language]);
  useEffect(() => { localStorage.setItem(`${draftKey}${language}`, code); }, [code, draftKey, language]);
  useEffect(() => { const refresh = () => setSettings(getSettings()); window.addEventListener('cses-settings-changed', refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener('cses-settings-changed', refresh); window.removeEventListener('storage', refresh); }; }, []);

  const run = useCallback(async () => {
    setBusy(true); setError(''); setOutput('');
    try {
      const result = await executeCode({ language, code, stdin: input });
      setOutput(result.output || result.stderr || (result.error ? '' : '(no output)'));
      if (result.error) setError(result.error);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Execution failed.');
    } finally { setBusy(false); }
  }, [code, input, language]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || event.keyCode === 229 || isShortcutRecordingTarget(event.target) || isDialogOpen()) return;
      const id = COMMAND_CATALOG.find(command => command.availableIn.includes('contest') && matchesShortcut(event, bindings[command.id]));
      if (!id || isEditableTarget(event.target) && id.id !== 'run') return;
      event.preventDefault(); event.stopPropagation();
      if (id.id === 'run' && !busy) run();
      if (id.id === 'focusEditor') document.querySelector<HTMLElement>('.monaco-editor textarea')?.focus();
      if (id.id === 'zen') document.querySelector<HTMLButtonElement>('button[title^="Enter Zen Mode"], button[title^="Exit Zen Mode"]')?.click();
      if (id.id === 'palette') setPaletteOpen(value => !value);
      if (id.id === 'settings') { setSettingsTab(undefined); setSettingsOpen(true); }
      if (id.id === 'help') { setSettingsTab('shortcuts'); setSettingsOpen(true); }
      if (id.id === 'appearance') { setSettingsTab('appearance'); setSettingsOpen(true); }
      if (id.id === 'cleanCode') window.dispatchEvent(new Event('cses-clean-llm-code'));
    };
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, [bindings, busy, run]);

  const commandActions = Object.fromEntries(COMMAND_CATALOG.map(command => {
    const runCommand = () => {
      if (command.id === 'run' && !busy) void run();
      if (command.id === 'palette') setPaletteOpen(true);
      if (command.id === 'settings') { setSettingsTab(undefined); setSettingsOpen(true); }
      if (command.id === 'help') { setSettingsTab('shortcuts'); setSettingsOpen(true); }
      if (command.id === 'appearance') { setSettingsTab('appearance'); setSettingsOpen(true); }
      if (command.id === 'focusEditor') document.querySelector<HTMLElement>('.monaco-editor textarea')?.focus();
      if (command.id === 'zen') document.querySelector<HTMLButtonElement>('button[title^="Enter Zen Mode"], button[title^="Exit Zen Mode"]')?.click();
      if (command.id === 'cleanCode') window.dispatchEvent(new Event('cses-clean-llm-code'));
    };
    const available = command.availableIn.includes('contest') && ['run','palette','settings','help','appearance','focusEditor','zen','cleanCode'].includes(command.id);
    return [command.id, { shortcut: bindings[command.id], run: runCommand, available }];
  }));

  return <main className="grid h-screen min-h-0 grid-rows-[auto_1fr] bg-surface-0 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3"><div><Link href="/" className="text-xs text-sky-300 underline underline-offset-2">← CSES Better</Link><h1 className="mt-1 text-lg font-semibold">{problem.title}</h1><p className="text-xs text-slate-400">{problem.contestId.toUpperCase()} · {problem.year} · {problem.round} · {problem.taskId}</p></div><a href={problem.sourceUrl} target="_blank" rel="noreferrer" className="rounded border border-border-muted px-3 py-2 text-sm text-slate-200 hover:bg-surface-2">Open official problem ↗</a></header>
    <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="min-h-0 space-y-5 overflow-y-auto border-b border-border-subtle p-5 lg:border-b-0 lg:border-r"><div className="flex justify-end"><AskAiMenu problem={{ title: problem.title, sourceUrl: problem.sourceUrl, statement: problem.statementAvailability === 'in-app-permitted' ? problem.statement : undefined, samples: problem.samples }} code={code} language={language} /></div><div><p className="mb-2 text-xs text-slate-400">{problem.tags.join(' · ')}</p>{problem.statementAvailability === 'in-app-permitted' && problem.statement ? <article className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{problem.statement}</article> : <p className="text-sm text-slate-400">The organizer’s problem statement is available at the official source link.</p>}</div><VisualExplanation visual={problem.visual} /></section>
      <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
        <EditorWorkbench code={code} onChange={setCode} language={language} onLanguageChange={setLanguage} onResetTemplate={() => setCode(getLanguageTemplate(language))} onRun={run} onSubmit={run} isRunning={busy} problemId={problem.id} problemTitle={problem.title} runShortcut={bindings.run} runAllShortcut={null} runAllAvailable={false} className="min-h-0" />
        <div className="grid max-h-[35vh] grid-cols-1 gap-3 overflow-y-auto border-t border-border-subtle p-4 sm:grid-cols-2"><label className="text-xs font-medium text-slate-400">Standard input<textarea value={input} onChange={event => setInput(event.target.value)} spellCheck={false} className="mt-2 h-32 w-full resize-y rounded border border-border-muted bg-surface-0 p-3 font-mono text-xs text-slate-200" placeholder="Paste your input" /></label><div className="min-h-32"><h2 className="text-xs font-medium text-slate-400">Run output</h2><pre aria-live="polite" className="mt-2 h-32 overflow-auto rounded border border-border-muted bg-surface-0 p-3 font-mono text-xs text-slate-200">{error ? `Error: ${error}` : output || 'Run your code to see output.'}</pre></div></div>
      </section>
    </div>
    <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} problems={[]} onSelectProblem={() => {}} solvedIds={new Set()} commands={commandActions} initialView="commands" />
    <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} initialTab={settingsTab} onUpdateSettings={next => { setSettings(next); saveSettings(next); }} />
  </main>;
}
