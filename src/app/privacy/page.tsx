import Link from 'next/link';
import { AppearanceEntry } from '../../components/AppearanceSettings';
import { pageMetadata } from '@/core/seo';

export const metadata = pageMetadata({
  title: 'Privacy',
  description: 'Learn how CSES Better handles local practice data, sign-in, code execution, and optional AI features.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-surface-0 px-6 py-16 text-text-primary">
      <article className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between"><Link href="/" className="text-accent hover:opacity-80">CSES Better</Link><AppearanceEntry /></div>
        <h1 className="mt-10 text-4xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-6 leading-7 text-text-secondary">Guest practice data, including drafts, solved problems, notes, and settings, is kept in this browser. If you sign in, selected progress can sync to your account. You can clear browser data through your browser settings; clearing it removes unsynced guest progress.</p>
        <p className="mt-5 leading-7 text-text-secondary">When you compile or run code, the code and test input are sent to the compiler service configured by this app. CSES account actions send the required requests through the app to CSES. The app does not save your CSES password; if you choose to remember your session, its session token is stored locally in your browser. Avoid using this feature on shared devices.</p>
        <p className="mt-5 leading-7 text-text-secondary">If you use an optional AI feature, the prompt and context you submit are sent to the configured AI provider. Do not include secrets or personal information in code, notes, or AI prompts.</p>
        <p className="mt-5 leading-7 text-text-secondary">CSES Better is an independent companion project and is not affiliated with CSES or the University of Helsinki. For feedback or privacy requests, use the <a className="text-accent underline" href="https://github.com/codewithpom/cses-better/issues">project issue tracker</a>.</p>
      </article>
    </main>
  );
}
