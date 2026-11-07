'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Moon, Sun, Monitor, Palette } from 'lucide-react';
import { useAppearance } from '../core/appearance-provider';

const themes = [
  { id: 'dark', label: 'Dark', description: 'Deep contrast for focused sessions.', icon: Moon },
  { id: 'dim', label: 'Dim', description: 'Softer surfaces with the same clear hierarchy.', icon: Moon },
  { id: 'light', label: 'Light', description: 'Bright surfaces for daylight use.', icon: Sun },
  { id: 'system', label: 'System', description: 'Follow your device appearance.', icon: Monitor },
] as const;

const accents = [
  { id: 'blue', label: 'Blue', color: '#38bdf8' },
  { id: 'teal', label: 'Teal', color: '#2dd4bf' },
  { id: 'green', label: 'Green', color: '#4ade80' },
  { id: 'orange', label: 'Orange', color: '#fb923c' },
  { id: 'pink', label: 'Pink', color: '#f472b6' },
] as const;

export function AppearanceSettings() {
  const { theme, accent, setAppearance } = useAppearance();

  return (
    <div className="space-y-6">
      <section aria-labelledby="appearance-theme-title">
        <h3 id="appearance-theme-title" className="text-sm font-semibold text-text-primary">Color theme</h3>
        <p className="mt-1 text-xs text-text-secondary">Choose the workspace brightness that feels comfortable.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Color theme">
          {themes.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={theme === id} onClick={() => setAppearance({ theme: id })}
              className={`min-h-11 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${theme === id ? 'border-accent bg-accent/10 text-text-primary' : 'border-border-muted bg-surface-2 text-text-secondary hover:border-accent/60 hover:text-text-primary'}`}>
              <Icon aria-hidden="true" className="mb-1 h-4 w-4 text-accent" />{label}
            </button>
          ))}
        </div>
      </section>
      <section aria-labelledby="appearance-accent-title">
        <h3 id="appearance-accent-title" className="text-sm font-semibold text-text-primary">Accent color</h3>
        <p className="mt-1 text-xs text-text-secondary">Used for selection, focus, and primary actions.</p>
        <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="Accent color">
          {accents.map(({ id, label, color }) => (
            <button key={id} type="button" role="radio" aria-checked={accent === id} aria-label={`${label} accent`} title={`${label} accent`}
              onClick={() => setAppearance({ accent: id })}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 ${accent === id ? 'border-text-primary' : 'border-transparent hover:border-border-muted'}`}>
              <span className="h-6 w-6 rounded-full" style={{ backgroundColor: color }} />
            </button>
          ))}
        </div>
      </section>
      <p className="text-xs text-text-muted">Appearance changes apply immediately and are saved on this device. The embedded OnlineCompiler editor keeps its own theme.</p>
    </div>
  );
}

/** Compact entry point for pages where the full workspace Settings modal is not available. */
export function AppearanceEntry() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);
  return (
    <div ref={rootRef} className="relative">
      <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-muted bg-surface-1 px-3 text-sm text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <Palette aria-hidden="true" className="h-4 w-4 text-accent" />Appearance
      </button>
      {open && <div role="dialog" aria-label="Appearance settings" className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border-muted bg-surface-1 p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-text-primary">Appearance</h2><button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="rounded px-2 py-1 text-xs text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Close</button></div>
        <AppearanceSettings />
      </div>}
    </div>
  );
}
