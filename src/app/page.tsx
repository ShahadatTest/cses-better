import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ArrowDownRight, ArrowRight, BookOpen, Check, Code2, ListChecks, StickyNote } from 'lucide-react';
import { LegacyEntry } from '../components/LegacyEntry';
import { AppearanceEntry } from '../components/AppearanceSettings';
import { LandingWorkspace } from '../components/LandingWorkspace';
import styles from './landing.module.css';
import { pageMetadata } from '@/core/seo';

export const metadata: Metadata = pageMetadata({
  title: 'CSES Better — A focused CSES practice workspace',
  description: 'Practice CSES problems with an integrated editor, test runner, notes, and progress tracking.',
  path: '/',
});

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <LegacyEntry />
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="CSES Better home"><span className={styles.mark}>C</span><span>CSES Better</span></Link>
        <nav className={styles.nav} aria-label="Main navigation">
          <a href="#workspace">Workspace</a>
          <a href="#practice">Practice</a>
          <a href="#progress">Progress</a>
          <AppearanceEntry />
          <Link href="/practice" className={styles.navAction}>Open practice <ArrowRight aria-hidden="true" size={15} /></Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.intro}>A focused workspace for the CSES Problem Set</p>
          <h1>Make room for the problem.</h1>
          <p className={styles.lede}>Read the statement, work through your solution, and run the sample in one calm place.</p>
          <div className={styles.heroActions}>
            <Link href="/practice" className={styles.primaryAction}>Start practicing <ArrowRight aria-hidden="true" size={17} /></Link>
            <span className={styles.guestNote}><Check aria-hidden="true" size={15} /> Start in guest mode</span>
          </div>
          <a className={styles.scrollCue} href="#workspace">See how it works <ArrowDownRight aria-hidden="true" size={15} /></a>
        </div>
        <div className={styles.heroDemo} id="workspace">
          <LandingWorkspace />
        </div>
      </section>

      <section className={styles.practice} id="practice">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>One workspace, fewer context switches</p>
          <h2>From first read to accepted.</h2>
          <p>Keep the tools you need close to the problem. Your code and notes stay beside the statement while you work.</p>
        </div>
        <div className={styles.featureList}>
          <article className={styles.featureRow}>
            <div className={styles.featureIcon}><BookOpen aria-hidden="true" /></div>
            <div><h3>Understand the task</h3><p>Read CSES statements with constraints, examples, and notes in view.</p></div>
            <span className={styles.featureMeta}>Problem set</span>
          </article>
          <article className={styles.featureRow}>
            <div className={styles.featureIcon}><Code2 aria-hidden="true" /></div>
            <div><h3>Build your solution</h3><p>Use an integrated editor, keep a draft, and try your own test cases.</p></div>
            <span className={styles.featureMeta}>Editor + tests</span>
          </article>
          <article className={styles.featureRow}>
            <div className={styles.featureIcon}><StickyNote aria-hidden="true" /></div>
            <div><h3>Keep useful context</h3><p>Save notes and return to the ideas you want to remember.</p></div>
            <span className={styles.featureMeta}>Notes + drafts</span>
          </article>
          <article className={styles.featureRow}>
            <div className={styles.featureIcon}><ListChecks aria-hidden="true" /></div>
            <div><h3>Choose what comes next</h3><p>Browse topics, organize problems into lists, and follow your own path.</p></div>
            <span className={styles.featureMeta}>Topics + lists</span>
          </article>
        </div>
        <figure className={styles.realScreenshot}>
          <Image src="/images/practice-workspace.jpg" alt="The CSES Better workspace with a problem list, code editor, and test bench" width={1280} height={800} />
          <figcaption>The actual workspace, with the problem and tools kept side by side.</figcaption>
        </figure>
      </section>

      <section className={styles.progress} id="progress">
        <div className={styles.progressText}>
          <p className={styles.kicker}>Your work, ready when you are</p>
          <h2>Pick up where you left off.</h2>
          <p>Track solved problems and submissions, revisit saved drafts, and sync your progress across devices when you sign in.</p>
          <Link href="/practice" className={styles.textAction}>Explore the problem set <ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
        <div className={styles.progressVisual} aria-label="Examples of progress you can keep">
          <div className={styles.progressLine}><span className={styles.progressGlyph}><Check aria-hidden="true" /></span><span><strong>Solved</strong><small>See what you have completed</small></span><span className={styles.status}>Saved</span></div>
          <div className={styles.progressLine}><span className={styles.progressGlyph}><StickyNote aria-hidden="true" /></span><span><strong>Drafts and notes</strong><small>Keep your working context</small></span><span className={styles.status}>Ready</span></div>
          <div className={styles.progressLine}><span className={styles.progressGlyph}><ArrowRight aria-hidden="true" /></span><span><strong>Next problem</strong><small>Return to your practice</small></span><span className={styles.status}>Continue</span></div>
        </div>
      </section>

      <section className={styles.close}>
        <div><p className={styles.kicker}>Start with one problem</p><h2>Your next idea is waiting.</h2><p>Open the workspace and get straight to practice. No account needed to begin.</p></div>
        <Link href="/practice" className={styles.closeAction}>Open CSES Better <ArrowRight aria-hidden="true" size={17} /></Link>
      </section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.wordmark}><span className={styles.mark}>C</span><span>CSES Better</span></Link>
        <p>Independent companion project. Not affiliated with CSES or the University of Helsinki.</p>
        <div><a href="https://github.com/codewithpom/cses-better">GitHub</a><Link href="/privacy">Privacy</Link><AppearanceEntry /></div>
      </footer>
    </main>
  );
}
