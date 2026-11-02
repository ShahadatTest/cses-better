import { LanguageId } from './types';

export interface ExtractedCodeResult {
  code: string;
  detectedLanguage?: LanguageId;
  wasMarkdown: boolean;
  fenceTag?: string;
}

/**
 * Maps markdown code fence tags (e.g., ```cpp, ```python, ```rs)
 * to internal CSES LanguageId types.
 */
export function normalizeFenceLanguage(tag?: string): LanguageId | undefined {
  if (!tag) return undefined;
  const lower = tag.trim().toLowerCase();
  if (['cpp', 'c++', 'cxx', 'cc', 'hpp', 'h'].includes(lower)) return 'cpp';
  if (['python', 'py', 'pypy', 'python3'].includes(lower)) return 'python';
  if (['java'].includes(lower)) return 'java';
  if (['rust', 'rs'].includes(lower)) return 'rust';
  if (['go', 'golang'].includes(lower)) return 'go';
  if (['javascript', 'js', 'node', 'nodejs'].includes(lower)) return 'javascript';
  if (['typescript', 'ts'].includes(lower)) return 'typescript';
  if (['c'].includes(lower)) return 'c';
  return undefined;
}

/**
 * Intelligently extracts compilable source code from LLM Markdown responses.
 * Handles single or multiple code fences, strips markdown formatting, and detects language.
 *
 * Compatible with outputs from:
 * - ChatGPT (GPT-4o, o1, o3)
 * - Anthropic Claude (3.5 Sonnet, 3.7 Sonnet)
 * - DeepSeek (DeepSeek R1, DeepSeek V3)
 * - Google Gemini (Gemini 2.0 Flash, Pro)
 * - GitHub Copilot
 */
export function extractCodeFromMarkdown(
  rawText: string,
  preferredLanguage?: LanguageId
): ExtractedCodeResult {
  if (!rawText || typeof rawText !== 'string') {
    return { code: '', wasMarkdown: false };
  }

  const trimmed = rawText.trim();

  // Regex to match markdown code fences: ```language\n...code...\n```
  const fenceRegex = /```([a-zA-Z0-9#+-]*)\s*\n?([\s\S]*?)```/g;
  const matches: Array<{ tag: string; body: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(trimmed)) !== null) {
    matches.push({
      tag: match[1] || '',
      body: match[2] || '',
    });
  }

  if (matches.length > 0) {
    // If a preferred language was provided, pick the matching fence if available
    let chosen = matches[0];
    if (preferredLanguage && matches.length > 1) {
      const preferredMatch = matches.find(
        (m) => normalizeFenceLanguage(m.tag) === preferredLanguage
      );
      if (preferredMatch) {
        chosen = preferredMatch;
      }
    }

    const detectedLanguage = normalizeFenceLanguage(chosen.tag);
    const cleanedCode = chosen.body.trim();

    return {
      code: cleanedCode,
      detectedLanguage,
      wasMarkdown: true,
      fenceTag: chosen.tag || undefined,
    };
  }

  // Check if text is wrapped in single backticks or markdown headers with code
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    const lines = trimmed.split('\n');
    const firstLine = lines[0].replace(/^```/, '').trim();
    const codeLines = lines.slice(1, -1);
    return {
      code: codeLines.join('\n').trim(),
      detectedLanguage: normalizeFenceLanguage(firstLine),
      wasMarkdown: true,
      fenceTag: firstLine || undefined,
    };
  }

  return {
    code: rawText,
    wasMarkdown: false,
  };
}
