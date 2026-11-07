import PracticeWorkspace from '../../components/PracticeWorkspace';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Practice CSES problems',
  alternates: { canonical: '/practice' },
  openGraph: { url: '/practice' },
};

export default function PracticePage() {
  return <PracticeWorkspace />;
}
