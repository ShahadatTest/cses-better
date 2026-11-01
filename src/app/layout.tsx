import type { Metadata } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'CSES Better — Modern Competitive Programming Platform & Judge',
  description:
    'A high-performance, modern competitive programming platform and automated judge for the CSES Problem Set.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface-0 text-slate-100 min-h-screen antialiased flex flex-col font-sans selection:bg-sky-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
