import type { Metadata } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';
import { AppearanceProvider } from '@/core/appearance-provider';
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_TITLE, getSiteUrl } from '@/core/seo';

const websiteStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'CSES Better',
  url: getSiteUrl().toString(),
  description: DEFAULT_SITE_DESCRIPTION,
};
const safeWebsiteStructuredData = JSON.stringify(websiteStructuredData).replace(/</g, '\\u003c');

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: { default: DEFAULT_SITE_TITLE, template: '%s | CSES Better' },
  description: DEFAULT_SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'CSES Better',
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    url: '/',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: DEFAULT_SITE_TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    images: ['/opengraph-image'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeWebsiteStructuredData }} />
        <script dangerouslySetInnerHTML={{ __html: `try{var s=JSON.parse(localStorage.getItem('cses_settings')||'{}');var t=s.theme||'dark';if(t==='system')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';if(!['dark','dim','light'].includes(t))t='dark';var a=['blue','teal','green','orange','pink'].includes(s.accent)?s.accent:'blue';document.documentElement.dataset.theme=t;document.documentElement.dataset.accent=a;document.documentElement.classList.toggle('dark',t!=='light')}catch(e){document.documentElement.dataset.theme='dark';document.documentElement.dataset.accent='blue';document.documentElement.classList.add('dark')}` }} />
      </head>
      <body className="bg-surface-0 text-primary min-h-screen antialiased flex flex-col font-sans selection:bg-accent/30">
        <AppearanceProvider>{children}</AppearanceProvider>
      </body>
    </html>
  );
}
