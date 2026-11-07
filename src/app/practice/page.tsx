import PracticeWorkspace from '../../components/PracticeWorkspace';
import { pageMetadata } from '@/core/seo';

export const metadata = pageMetadata({
  title: 'Practice CSES Problems',
  description: 'Browse CSES problems, write solutions in the built-in editor, run tests, and track your practice.',
  path: '/practice',
});

export default function PracticePage() {
  return <PracticeWorkspace />;
}
