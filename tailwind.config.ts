import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'surface-0': 'var(--surface-0, #090d16)',
        'surface-1': 'var(--surface-1, #0f172a)',
        'surface-2': 'var(--surface-2, #1e293b)',
        'surface-3': 'var(--surface-3, #334155)',
        'border-subtle': 'var(--border-subtle, #1e293b)',
        'border-muted': 'var(--border-muted, #334155)',
        'border-accent': '#38bdf8',
        'verdict-ac': '#10b981',
        'verdict-wa': '#f43f5e',
        'verdict-tle': '#f59e0b',
        'verdict-ce': '#a855f7',
        surface: {
          0: 'var(--surface-0, #090d16)',
          1: 'var(--surface-1, #0f172a)',
          2: 'var(--surface-2, #1e293b)',
          3: 'var(--surface-3, #334155)',
        },
        verdict: {
          ac: '#10b981',
          wa: '#f43f5e',
          tle: '#f59e0b',
          ce: '#a855f7',
        },
      },
    },
  },
  plugins: [],
};

export default config;
