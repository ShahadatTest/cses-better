import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import problems from '../src/data/problems.json';

describe('bundled lessons', () => {
  it('has one valid UTF-8 lesson per catalog problem and no extras', () => {
    const directory = join(process.cwd(), 'public', 'learn');
    const ids = new Set(problems.map(problem => problem.id));
    const files = readdirSync(directory).filter(name => name.endsWith('.json'));
    expect(files.map(name => name.slice(0, -5)).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      const bytes = readFileSync(join(directory, `${id}.json`));
      expect([...bytes.subarray(0, 3)], `${id} must not have a UTF-8 BOM`).not.toEqual([0xef, 0xbb, 0xbf]);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const lesson = JSON.parse(text);
      expect(Object.keys(lesson).sort(), id).toEqual(['algorithm', 'analogy', 'complexity', 'correctness', 'diagram', 'example', 'hints', 'visual']);
      expect(lesson.hints, id).toHaveLength(3);
      expect(lesson.hints.every((hint: unknown) => typeof hint === 'string' && hint.trim()), id).toBe(true);
      expect(new Set(lesson.hints).size, id).toBe(3);
      for (const key of ['analogy', 'example', 'algorithm', 'correctness', 'complexity']) expect(typeof lesson[key] === 'string' && lesson[key].trim().length > 0, `${id}: ${key}`).toBe(true);
      expect(lesson.visual, id).toMatchObject({ kind: expect.any(String), title: expect.any(String), caption: expect.any(String) });
      expect(lesson.visual.steps.length, id).toBeGreaterThanOrEqual(2);
      expect(lesson.visual.steps.every((step: any) => step.label.trim() && step.detail.trim()), id).toBe(true);
      expect(['sequence', 'table', 'grid', 'graph', 'tree', 'intervals'], id).toContain(lesson.diagram.type);
    }
  });
});
