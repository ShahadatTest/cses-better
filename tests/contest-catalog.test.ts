import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contestProblems } from '../src/data/olympiad';

describe('Olympiad catalog', () => {
  it('has stable, separate task identity and official HTTPS sources', () => {
    const ids = contestProblems.map(problem => problem.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))).toBe(true);
    for (const problem of contestProblems) {
      expect(['zio', 'zco', 'inoi', 'usaco']).toContain(problem.contestId);
      expect(Number.isInteger(problem.year)).toBe(true);
      expect(problem.title.trim()).toBeTruthy();
      expect(new URL(problem.sourceUrl).protocol).toBe('https:');
    }
  });

  it('provides a visual explanation for each imported task', () => {
    expect(contestProblems.length).toBeGreaterThan(500);
    for (const problem of contestProblems) {
      expect(problem.visual.title.trim(), problem.id).toBeTruthy();
      expect(problem.visual.caption.trim(), problem.id).toBeTruthy();
      expect(problem.visual.steps.length, problem.id).toBeGreaterThanOrEqual(2);
      expect(problem.visual.steps.every(step => step.label.trim() && step.detail.trim()), problem.id).toBe(true);
      const diagram = problem.visual.diagram as any;
      expect(diagram, problem.id).toBeTruthy();
      expect(
        (diagram.type === 'sequence' && Array.isArray(diagram.items) && diagram.items.length > 0) ||
        (Array.isArray(diagram.nodes) && diagram.nodes.length > 0 && Array.isArray(diagram.edges)) ||
        (['table', 'grid'].includes(diagram.type) && Array.isArray(diagram.rows ?? diagram.cells)) ||
        (diagram.type === 'intervals' && Array.isArray(diagram.items)) ||
        Object.keys(diagram).length > 0,
        problem.id,
      ).toBe(true);
    }
  });

  it('runs contest workspaces through the compiler without calling CSES-only routes', () => {
    const workspace = readFileSync(join(process.cwd(), 'src/components/ContestWorkspace.tsx'), 'utf8');
    expect(workspace).toContain('executeCode(');
    expect(workspace).not.toContain('/api/cses/');
    expect(workspace).not.toContain('/api/tests/');
  });
});
