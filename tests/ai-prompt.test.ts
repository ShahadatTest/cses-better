import { describe, expect, it } from 'vitest';
import { AI_PROVIDERS, buildAiPrompt, csesAiContext, statementText } from '../src/core/ai-prompt';

describe('AI problem handoff', () => {
  const problem = { title: 'Two sums', sourceUrl: 'https://cses.fi/problemset/task/1640/', statement: 'Find two values.', constraints: ['n <= 100'], samples: [{ input: '2 5\n2 3', output: '1 2' }] };
  it('includes the real problem, constraints, samples, source and hint-first instruction', () => {
    const prompt = buildAiPrompt(problem);
    for (const expected of ['Two sums', problem.sourceUrl, 'n <= 100', '2 5\n2 3', '1 2', 'Start with one small hint']) expect(prompt).toContain(expected);
    expect(prompt).not.toContain('My current code');
  });
  it('includes code only when explicitly supplied', () => {
    expect(buildAiPrompt(problem, 'print(42)', 'python')).toContain('My current code (python):\nprint(42)');
    expect(buildAiPrompt(problem, '  ')).not.toContain('My current code');
  });
  it('handles link-only problems without inventing a statement', () => {
    expect(buildAiPrompt({ title: 'Olympiad', sourceUrl: 'https://example.org/task' })).toContain('The full statement is at the official source');
  });
  it('turns statements into readable text and preserves math comparisons', () => {
    expect(statementText('<h1>Input</h1><p>1 &lt; n &le; 10 &amp; x &#8804; 20</p><script>bad()</script>')).toBe('Input\n1 < n &le; 10 & x ≤ 20');
    expect(statementText('&#x1F600; &#1114112;')).toBe('😀 &#1114112;');
  });
  it('includes samples only, excluding private/custom tests', () => {
    const context = csesAiContext({ id: '1', title: 'Task', category: 'Test', timeLimit: '1 s', memoryLimit: '512 MB', statementHtml: '<p>Hello</p>', testCases: [{ id: 'sample', input: '1', expectedOutput: '2' }, { id: 'custom', input: 'private', expectedOutput: 'x', isSample: false }] });
    expect(context.samples).toEqual([{ input: '1', output: '2' }]);
    expect(context.statement).toBe('Hello');
    expect(context.timeLimit).toBe('1 s');
  });
  it('launches providers on HTTPS without exposing code in URL parameters', () => {
    expect(AI_PROVIDERS).toHaveLength(4);
    for (const provider of AI_PROVIDERS) { const url = new URL(provider.url); expect(url.protocol).toBe('https:'); expect(url.search).toBe(''); }
  });
});
