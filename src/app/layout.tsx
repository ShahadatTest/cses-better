import type { Metadata } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';
import { AppearanceProvider } from '@/core/appearance-provider';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cses-better.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'CSES Better — A focused CSES practice workspace', template: '%s | CSES Better' },
  description: 'Practice CSES problems with an integrated editor, test runner, notes, and progress tracking.',
  openGraph: {
    type: 'website', siteName: 'CSES Better', title: 'CSES Better — A focused CSES practice workspace',
    description: 'Practice CSES problems with an integrated editor, test runner, notes, and progress tracking.',
    url: '/', images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'CSES Better — a focused CSES practice workspace' }],
  },
  twitter: { card: 'summary_large_image', title: 'CSES Better — A focused CSES practice workspace', description: 'Practice CSES problems with an integrated editor, test runner, notes, and progress tracking.', images: ['/opengraph-image'] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var s=JSON.parse(localStorage.getItem('cses_settings')||'{}');var t=s.theme||'dark';if(t==='system')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';if(!['dark','dim','light'].includes(t))t='dark';var a=['blue','teal','green','orange','pink'].includes(s.accent)?s.accent:'blue';document.documentElement.dataset.theme=t;document.documentElement.dataset.accent=a;document.documentElement.classList.toggle('dark',t!=='light')}catch(e){document.documentElement.dataset.theme='dark';document.documentElement.dataset.accent='blue';document.documentElement.classList.add('dark')}` }} />
      </head>
      <body className="bg-surface-0 text-primary min-h-screen antialiased flex flex-col font-sans selection:bg-accent/30">
        <AppearanceProvider>{children}</AppearanceProvider>
      </body>
    </html>
  );
}
