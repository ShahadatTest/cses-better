import Link from 'next/link';
import Image from 'next/image';
import { LegacyEntry } from '../components/LegacyEntry';
import type { Metadata } from 'next';
import { AppearanceEntry } from '../components/AppearanceSettings';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-surface-0 text-text-primary">
      <LegacyEntry />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="text-lg font-semibold tracking-tight">CSES Better</Link>
        <nav className="flex items-center gap-7 text-sm text-text-secondary">
          <a className="hidden hover:text-text-primary sm:inline" href="#learn">Learn</a>
          <a className="hidden hover:text-text-primary sm:inline" href="#progress">Your progress</a>
          <a className="hidden hover:text-text-primary sm:inline" href="#contribute">Contribute</a>
          <AppearanceEntry />
          <Link href="/practice" className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-foreground hover:opacity-90">Open practice</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:pb-28 lg:pt-20">
        <div>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-7xl">A calmer way to solve CSES.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-text-secondary">Practice problems in a focused workspace with a built-in editor, test runner, notes, and progress tracking.</p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link href="/practice" className="rounded-md bg-accent px-6 py-3 font-semibold text-accent-foreground hover:opacity-90">Start practicing</Link>
            <span className="text-sm text-text-muted">Guest mode is ready right away.</span>
          </div>
        </div>
        <Link href="/practice" aria-label="Open CSES Better practice workspace" className="block overflow-hidden rounded-xl bg-surface-1 ring-1 ring-border-subtle">
          <Image src="/images/practice-workspace.jpg" alt="CSES Better problem list, code editor, and test bench" width={1280} height={800} priority className="h-auto w-full" />
        </Link>
      </section>

      <section id="learn" className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-10 lg:py-28">
          <div><h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">Understand each problem.</h2><p className="mt-5 max-w-md leading-7 text-text-secondary">Explore the CSES Problem Set with an editor and test bench beside every statement. Save notes and drafts as you work.</p></div>
          <div className="grid gap-8 sm:grid-cols-2">
            <div><h3 className="text-xl font-semibold">Learn</h3><p className="mt-3 leading-7 text-text-secondary">Browse topic roadmaps and visual explanations that make tricky ideas easier to see.</p></div>
            <div><h3 className="text-xl font-semibold">Make lists</h3><p className="mt-3 leading-7 text-text-secondary">Collect problems into personal lists and use them to shape your next practice session.</p></div>
          </div>
        </div>
      </section>

      <section id="progress" className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-2 lg:px-10 lg:py-28">
        <div><h2 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight">See the work you have put in.</h2><p className="mt-5 max-w-lg leading-7 text-text-secondary">Keep track of solved problems and submissions, revisit your drafts, and pick up where you left off. Sign in when you want your progress synced across devices.</p></div>
        <div className="flex flex-col justify-center gap-5 sm:flex-row sm:gap-12">
          <div><p className="text-4xl font-semibold text-accent">Solved</p><p className="mt-2 text-text-secondary">Track completed problems</p></div>
          <div><p className="text-4xl font-semibold text-accent">Saved</p><p className="mt-2 text-text-secondary">Return to drafts and notes</p></div>
          <div><p className="text-4xl font-semibold text-accent">Synced</p><p className="mt-2 text-text-secondary">Keep progress across devices</p></div>
        </div>
      </section>

      <section id="contribute" className="bg-accent text-accent-foreground">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-6 py-16 sm:flex-row sm:items-center lg:px-10">
          <div><h2 className="text-3xl font-semibold tracking-tight">Built for learners, improved together.</h2><p className="mt-3 max-w-xl leading-7">CSES Better is an independent, community-built companion. Share feedback or help make it better.</p></div>
          <div className="flex flex-wrap gap-4"><a href="https://github.com/codewithpom/cses-better" className="rounded-md bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800">Contribute on GitHub</a><a href="https://github.com/codewithpom/cses-better/issues" className="rounded-md px-5 py-3 font-semibold ring-1 ring-slate-950/40 hover:bg-accent">Send feedback</a></div>
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <p>CSES Better is an unofficial companion project and is not affiliated with CSES or the University of Helsinki.</p>
        <div className="flex items-center gap-4"><AppearanceEntry /><Link className="text-text-secondary hover:text-text-primary" href="/privacy">Privacy</Link></div>
      </footer>
    </main>
  );
}
