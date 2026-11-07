import PracticeWorkspace from '../../../components/PracticeWorkspace';
import { notFound } from 'next/navigation';
import problems from '@/data/problems.json';
import { pageMetadata } from '@/core/seo';

type PracticeQuestionPageProps = { params: { id: string } };
const problemsById = new Map(problems.map((problem) => [problem.id, problem]));

export async function generateMetadata({ params }: PracticeQuestionPageProps) {
  const problem = problemsById.get(params.id);
  if (!problem) return { robots: { index: false, follow: false } };

  return pageMetadata({
    title: `${problem.title} – CSES Practice`,
    description: `Solve ${problem.title} from the CSES ${problem.category} problem set in CSES Better.`,
    path: `/practice/${encodeURIComponent(problem.id)}`,
  });
}

export default function PracticeQuestionPage({ params }: PracticeQuestionPageProps) {
  if (!problemsById.has(params.id)) notFound();
  return <PracticeWorkspace initialProblemId={params.id} />;
}
