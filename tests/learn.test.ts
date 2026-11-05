import { describe, expect, it } from 'vitest';
import { isLearnContent } from '../src/components/ProblemPane';

const valid = {
  hints: ['a', 'b', 'c'], analogy: 'analogy', example: 'example', algorithm: 'algorithm', correctness: 'correctness', complexity: 'complexity',
  visual: { kind: 'trace', title: 'Trace the sample', caption: 'Track each state.', steps: [{ label: 'Start', detail: 'The first state.' }, { label: 'Finish', detail: 'The result.' }] },
  diagram: { type: 'sequence', items: ['start', 'end'] },
};

describe('lesson validation', () => {
  it('requires three hints, all lesson sections, and a visual explanation', () => {
    expect(isLearnContent(valid)).toBe(true);
    expect(isLearnContent({ ...valid, hints: ['a'] })).toBe(false);
    expect(isLearnContent({ ...valid, algorithm: null })).toBe(false);
    expect(isLearnContent({ ...valid, visual: undefined })).toBe(false);
    expect(isLearnContent({ ...valid, visual: { ...valid.visual, steps: [] } })).toBe(false);
    expect(isLearnContent({ ...valid, diagram: undefined })).toBe(false);
  });
});
