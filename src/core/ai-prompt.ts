import type { LanguageId, Problem } from './types';

export const AI_PROVIDERS = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app' },
  { id: 'grok', name: 'Grok', url: 'https://grok.com/' },
] as const;

export interface AiProblemContext {
  title: string;
  sourceUrl: string;
  statement?: string;
  constraints?: string[];
  samples?: { input: string; output: string }[];
  timeLimit?: string;
  memoryLimit?: string;
}

export function statementText(html: string): string {
  const text = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(?:p|div|h[1-6]|li|pre|tr|section)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(text.replace(/</g, '&lt;'), 'text/html').documentElement.textContent?.trim() || '';
  }
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? match;
    const value = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : match;
  }).trim();
}

export function csesAiContext(problem: Problem): AiProblemContext {
  return {
    title: problem.title,
    sourceUrl: `https://cses.fi/problemset/task/${problem.id}/`,
    statement: statementText(problem.statementHtml),
    constraints: problem.constraints?.map(statementText),
    samples: problem.testCases.filter(test => test.isSample !== false).map(test => ({ input: test.input, output: test.expectedOutput })),
    timeLimit: problem.timeLimit,
    memoryLimit: problem.memoryLimit,
  };
}

export function buildAiPrompt(problem: AiProblemContext, code?: string, language?: LanguageId): string {
  return [
    'Help me understand and solve this competitive programming problem. Start with one small hint. Do not reveal the full solution or write solution code unless I ask. If I include my code, help me identify the issue with a hint first.',
    `Problem: ${problem.title}`,
    `Official source: ${problem.sourceUrl}`,
    problem.timeLimit ? `Time limit: ${problem.timeLimit}` : '',
    problem.memoryLimit ? `Memory limit: ${problem.memoryLimit}` : '',
    problem.statement ? `Statement:\n${problem.statement}` : 'The full statement is at the official source link above.',
    problem.constraints?.length ? `Constraints:\n${problem.constraints.join('\n')}` : '',
    ...(problem.samples || []).map((sample, index) => `Sample ${index + 1}\nInput:\n${sample.input}\nExpected output:\n${sample.output}`),
    code?.trim() ? `My current code (${language || 'unspecified language'}):\n${code}` : '',
  ].filter(Boolean).join('\n\n');
}
