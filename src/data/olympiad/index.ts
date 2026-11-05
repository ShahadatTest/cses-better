import india from './india/index.json';
import usaco from './usaco/index.json';
import type { ContestProblem } from '@/core/contest-types';

export const contestProblems = [...india, ...usaco] as ContestProblem[];

export function findContestProblem(id: string): ContestProblem | undefined {
  return contestProblems.find(problem => problem.id === id);
}
