import { notFound } from 'next/navigation';
import { ContestWorkspace } from '@/components/ContestWorkspace';
import { findContestProblem } from '@/data/olympiad';

export default function OlympiadProblemPage({ params }: { params: { id: string } }) {
  const problem = findContestProblem(params.id);
  if (!problem) notFound();
  return <ContestWorkspace problem={problem} />;
}
