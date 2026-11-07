'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSettings, saveSettings } from './storage';
import { DEFAULT_APP_SETTINGS } from './types';
import type { AppSettings } from './types';

type ResolvedTheme = 'dark' | 'dim' | 'light';
type AppearanceContextValue = {
  theme: AppSettings['theme'];
  accent: AppSettings['accent'];
  resolvedTheme: ResolvedTheme;
  setAppearance: (patch: Partial<Pick<AppSettings, 'theme' | 'accent'>>) => void;
};
const AppearanceContext = createContext<AppearanceContextValue>({
  theme: DEFAULT_APP_SETTINGS.theme, accent: DEFAULT_APP_SETTINGS.accent, resolvedTheme: 'dark', setAppearance: () => undefined,
});
const accents: AppSettings['accent'][] = ['blue', 'teal', 'green', 'orange', 'pink'];
const themes: AppSettings['theme'][] = ['dark', 'dim', 'light', 'system'];

function systemTheme(): ResolvedTheme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyAppearance(theme: AppSettings['theme'], accent: AppSettings['accent']): ResolvedTheme {
  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme() : theme;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.accent = accents.includes(accent) ? accent : 'blue';
    document.documentElement.classList.toggle('dark', resolvedTheme !== 'light');
  }
  return resolvedTheme;
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');
  const apply = useCallback((next: AppSettings) => {
    setResolvedTheme(applyAppearance(next.theme, next.accent));
  }, []);

  useEffect(() => {
    const refresh = () => {
      const next = getSettings();
      setSettings(next);
      apply(next);
    };
    refresh();
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    const systemChanged = () => { if (getSettings().theme === 'system') refresh(); };
    const storageChanged = (event: StorageEvent) => { if (!event.key || event.key === 'cses_settings') refresh(); };
    media?.addEventListener?.('change', systemChanged);
    window.addEventListener('storage', storageChanged);
    window.addEventListener('cses-settings-changed', refresh);
    window.addEventListener('cses-storage-cleared', refresh);
    return () => {
      media?.removeEventListener?.('change', systemChanged);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('cses-settings-changed', refresh);
      window.removeEventListener('cses-storage-cleared', refresh);
    };
  }, [apply]);

  const setAppearance = useCallback((patch: Partial<Pick<AppSettings, 'theme' | 'accent'>>) => {
    const next = { ...getSettings(), ...patch };
    if (!themes.includes(next.theme)) next.theme = 'dark';
    if (!accents.includes(next.accent)) next.accent = 'blue';
    saveSettings(next);
    setSettings(next);
    apply(next);
  }, [apply]);

  const value = useMemo(() => ({ theme: settings.theme, accent: settings.accent, resolvedTheme, setAppearance }), [settings.theme, settings.accent, resolvedTheme, setAppearance]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  return useContext(AppearanceContext);
}
