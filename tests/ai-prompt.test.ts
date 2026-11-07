import { describe, expect, it } from 'vitest';
import { AI_PROVIDERS, buildAiPrompt, buildAiProviderUrl, csesAiContext, MAX_AI_PROMPT_URL_LENGTH, statementText } from '../src/core/ai-prompt';

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
  it('prefills only providers with verified prompt-link formats', () => {
    const prompt = buildAiPrompt(problem);
    const grok = new URL(buildAiProviderUrl('grok', prompt));
    expect(grok.origin).toBe('https://grok.com');
    expect(grok.searchParams.get('q')).toBe(prompt);
    expect(new URL(buildAiProviderUrl('chatgpt', prompt)).search).toBe('');
    expect(new URL(buildAiProviderUrl('claude', prompt)).search).toBe('');
    expect(new URL(buildAiProviderUrl('gemini', prompt)).search).toBe('');
    const desktop = buildAiProviderUrl('claude-desktop', prompt);
    expect(desktop.startsWith('claude://claude.ai/new?q=')).toBe(true);
    expect(new URL(desktop).searchParams.get('q')).toBe(prompt);
    expect(AI_PROVIDERS).toHaveLength(4);
  });
  it('includes code in prompt links only when the prompt was built with code', () => {
    const withoutCode = new URL(buildAiProviderUrl('grok', buildAiPrompt(problem)));
    const withCode = new URL(buildAiProviderUrl('grok', buildAiPrompt(problem, 'print(42)', 'python')));
    expect(withoutCode.searchParams.get('q')).not.toContain('print(42)');
    expect(withCode.searchParams.get('q')).toContain('print(42)');
  });
  it('falls back to base links instead of truncating overlong prompts', () => {
    const longPrompt = 'x'.repeat(MAX_AI_PROMPT_URL_LENGTH);
    expect(buildAiProviderUrl('grok', longPrompt)).toBe('https://grok.com/');
    expect(buildAiProviderUrl('claude-desktop', longPrompt)).toBe('claude://claude.ai/new');
  });
});
