export type ThemeMode = 'dark' | 'light' | 'system';

const THEME_STORAGE_KEY = 'cses_theme';
let memoryTheme: ThemeMode = 'dark';

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return memoryTheme;
  try {
    const val = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
    if (val === 'light' || val === 'dark' || val === 'system') return val;
  } catch {}
  return memoryTheme;
}

export function applyTheme(mode: ThemeMode): void {
  memoryTheme = mode;
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {}
}

export function toggleTheme(): ThemeMode {
  const current = getStoredTheme();
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
