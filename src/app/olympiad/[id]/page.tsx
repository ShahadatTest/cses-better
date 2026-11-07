import { notFound } from 'next/navigation';
import { ContestWorkspace } from '@/components/ContestWorkspace';
import { findContestProblem } from '@/data/olympiad';
import { pageMetadata } from '@/core/seo';

export function generateMetadata({ params }: { params: { id: string } }) {
  const problem = findContestProblem(params.id);
  if (!problem) return { robots: { index: false, follow: false } };

  const contestName = problem.contestId.toUpperCase();
  return pageMetadata({
    title: `${problem.title} – ${contestName} ${problem.year}`,
    description: `Explore ${problem.title}, ${problem.round} ${contestName} ${problem.year} ${problem.taskId}. View the competition source and a visual problem explanation in CSES Better.`,
    path: `/olympiad/${encodeURIComponent(problem.id)}`,
  });
}

export default function OlympiadProblemPage({ params }: { params: { id: string } }) {
  const problem = findContestProblem(params.id);
  if (!problem) notFound();
  return <ContestWorkspace problem={problem} />;
}
