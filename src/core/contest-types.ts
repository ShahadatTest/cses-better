export type ContestId = 'zio' | 'zco' | 'inoi' | 'usaco';

export interface ContestVisual {
  kind: string;
  title: string;
  caption: string;
  steps: { label: string; detail: string }[];
  diagram?: Record<string, unknown>;
}

export interface ContestProblem {
  id: string;
  contestId: ContestId;
  year: number;
  round: string;
  taskId: string;
  title: string;
  sourceUrl: string;
  statementAvailability: 'official-link' | 'in-app-permitted' | 'unavailable';
  tags: string[];
  visual: ContestVisual;
  statement?: string;
  samples?: { input: string; output: string }[];
}
