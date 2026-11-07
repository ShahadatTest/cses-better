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
        'surface-0': 'rgb(var(--surface-0-rgb, 9 13 22) / <alpha-value>)',
        'surface-1': 'rgb(var(--surface-1-rgb, 15 23 42) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2-rgb, 30 41 59) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3-rgb, 51 65 85) / <alpha-value>)',
        'border-subtle': 'rgb(var(--border-subtle-rgb, 30 41 59) / <alpha-value>)',
        'border-muted': 'rgb(var(--border-muted-rgb, 51 65 85) / <alpha-value>)',
        'border-accent': 'var(--accent)',
        'text-primary': 'rgb(var(--text-primary-rgb, 241 245 249) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary-rgb, 203 213 225) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted-rgb, 148 163 184) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        'accent-foreground': 'var(--accent-foreground)',
        'verdict-ac': 'rgb(var(--verdict-ac-rgb, 74 222 128) / <alpha-value>)',
        'verdict-ac-soft': 'rgb(var(--verdict-ac-soft-rgb, 23 59 37) / <alpha-value>)',
        'verdict-wa': 'rgb(var(--verdict-wa-rgb, 251 113 133) / <alpha-value>)',
        'verdict-wa-soft': 'rgb(var(--verdict-wa-soft-rgb, 76 23 39) / <alpha-value>)',
        'verdict-tle': 'rgb(var(--verdict-tle-rgb, 251 191 36) / <alpha-value>)',
        'verdict-tle-soft': 'rgb(var(--verdict-tle-soft-rgb, 74 50 22) / <alpha-value>)',
        'verdict-ce': 'rgb(var(--verdict-ce-rgb, 192 132 252) / <alpha-value>)',
        'verdict-ce-soft': 'rgb(var(--verdict-ce-soft-rgb, 46 28 74) / <alpha-value>)',
        surface: {
          0: 'rgb(var(--surface-0-rgb, 9 13 22) / <alpha-value>)',
          1: 'rgb(var(--surface-1-rgb, 15 23 42) / <alpha-value>)',
          2: 'rgb(var(--surface-2-rgb, 30 41 59) / <alpha-value>)',
          3: 'rgb(var(--surface-3-rgb, 51 65 85) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary-rgb, 241 245 249) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary-rgb, 203 213 225) / <alpha-value>)',
          muted: 'rgb(var(--text-muted-rgb, 148 163 184) / <alpha-value>)',
        },
        verdict: {
          ac: 'rgb(var(--verdict-ac-rgb, 74 222 128) / <alpha-value>)',
          'ac-soft': 'rgb(var(--verdict-ac-soft-rgb, 23 59 37) / <alpha-value>)',
          wa: 'rgb(var(--verdict-wa-rgb, 251 113 133) / <alpha-value>)',
          'wa-soft': 'rgb(var(--verdict-wa-soft-rgb, 76 23 39) / <alpha-value>)',
          tle: 'rgb(var(--verdict-tle-rgb, 251 191 36) / <alpha-value>)',
          'tle-soft': 'rgb(var(--verdict-tle-soft-rgb, 74 50 22) / <alpha-value>)',
          ce: 'rgb(var(--verdict-ce-rgb, 192 132 252) / <alpha-value>)',
          'ce-soft': 'rgb(var(--verdict-ce-soft-rgb, 46 28 74) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
