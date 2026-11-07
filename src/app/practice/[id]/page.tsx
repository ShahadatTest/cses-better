import PracticeWorkspace from '../../../components/PracticeWorkspace';
import type { Metadata } from 'next';

type PracticeQuestionPageProps = { params: { id: string } };

export async function generateMetadata({ params }: PracticeQuestionPageProps): Promise<Metadata> {
  return {
    title: `Practice problem ${params.id}`,
    alternates: { canonical: `/practice/${encodeURIComponent(params.id)}` },
    openGraph: { url: `/practice/${encodeURIComponent(params.id)}` },
  };
}

export default function PracticeQuestionPage({ params }: PracticeQuestionPageProps) {
  return <PracticeWorkspace initialProblemId={params.id} />;
}
