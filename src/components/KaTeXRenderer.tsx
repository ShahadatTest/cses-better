'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import DOMPurify from 'isomorphic-dompurify';
import { cn } from '@/lib/utils';

export interface KaTeXRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
  displayMode?: boolean;
}

function decodeMathEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&le;/g, '\\le ')
    .replace(/&ge;/g, '\\ge ')
    .replace(/&ne;/g, '\\ne ')
    .replace(/&times;/g, '\\times ')
    .replace(/&plusmn;/g, '\\pm ');
}

/**
 * Safely renders a single LaTeX formula string using KaTeX.
 * Handles errors gracefully and never throws.
 */
export function renderMathFormula(
  latex: string,
  displayMode: boolean = false
): string {
  if (!latex || typeof latex !== 'string') return '';
  try {
    const cleaned = decodeMathEntities(latex.trim());
    return katex.renderToString(cleaned, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: false,
    });
  } catch {
    const escaped = latex
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<span class="katex-error text-verdict-wa font-mono text-xs px-1 py-0.5 rounded bg-verdict-wa/10">${escaped}</span>`;
  }
}

/**
 * Processes a raw HTML string or markdown-like string with LaTeX math:
 * - `<span class="math math-display">...</span>`
 * - `<span class="math math-inline">...</span>`
 * - `<span class="math">...</span>`
 * - `$$...$$`
 * - `$...$`
 */
export function renderKatexInHtml(
  content: string,
  defaultInline: boolean = false
): string {
  if (!content || typeof content !== 'string') return '';

  const trimmed = content.trim();

  // If content is wrapped in standard math tags or dollar signs, parse them
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(trimmed);
  const hasSpanMath = /<span\s+class=["']math/i.test(trimmed);
  const hasDollarMath = /\$/.test(trimmed);

  // If it's a raw latex formula without tags or dollar signs, render directly
  if (!hasHtmlTags && !hasDollarMath && defaultInline) {
    return renderMathFormula(trimmed, false);
  }

  let result = trimmed;

  // 1. Display math spans: <span class="math math-display">...</span>
  result = result.replace(
    /<span\s+class=["']math\s+math-display["']>([\s\S]*?)<\/span>/gi,
    (_, math) => renderMathFormula(math, true)
  );

  // 2. Inline math spans: <span class="math math-inline">...</span>
  result = result.replace(
    /<span\s+class=["']math\s+math-inline["']>([\s\S]*?)<\/span>/gi,
    (_, math) => renderMathFormula(math, false)
  );

  // 3. Generic math spans: <span class="math">...</span>
  result = result.replace(
    /<span\s+class=["']math["']>([\s\S]*?)<\/span>/gi,
    (_, math) => renderMathFormula(math, false)
  );

  // 4. Display math: $$...$$
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) =>
    renderMathFormula(math, true)
  );

  // 5. Inline math: $...$
  result = result.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (_, prefix, math) =>
    `${prefix}${renderMathFormula(math, false)}`
  );

  return result;
}

export function sanitizeMathHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
  });
}

export const KaTeXRenderer: React.FC<KaTeXRendererProps> = ({
  content,
  className,
  inline = false,
  displayMode = false,
}) => {
  const renderedHtml = useMemo(() => {
    if (!content) return '';
    const raw = displayMode
      ? renderMathFormula(content, true)
      : renderKatexInHtml(content, inline);
    return sanitizeMathHtml(raw);
  }, [content, inline, displayMode]);

  if (!content) return null;

  if (inline) {
    return (
      <span
        className={cn(
          'inline-flex items-center align-baseline text-text-primary [&_.katex]:text-text-primary',
          className
        )}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    );
  }

  return (
    <div
      className={cn(
        'katex-content text-text-secondary text-sm leading-relaxed',
        // Headings
        '[&_h1]:text-xs [&_h1]:font-semibold [&_h1]:uppercase [&_h1]:tracking-wider [&_h1]:text-text-muted [&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:pb-1.5 [&_h1]:border-b [&_h1]:border-border-subtle',
        '[&_h2]:text-xs [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wider [&_h2]:text-text-muted [&_h2]:mt-5 [&_h2]:mb-2',
        // Paragraphs & Lists
        '[&_p]:text-text-secondary [&_p]:leading-relaxed [&_p]:mb-3 [&_p]:text-sm',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:mb-3 [&_ul]:text-text-secondary [&_ul]:text-sm',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:mb-3 [&_ol]:text-text-secondary [&_ol]:text-sm',
        '[&_li]:text-text-secondary',
        // Pre & Code
        '[&_pre]:bg-surface-0 [&_pre]:border [&_pre]:border-border-subtle [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:text-text-primary [&_pre]:overflow-x-auto [&_pre]:my-2.5',
        '[&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-text-primary',
        // KaTeX specific alignment
        '[&_.katex-display]:my-3 [&_.katex-display]:py-1.5 [&_.katex-display]:overflow-x-auto [&_.katex-display]:text-center',
        '[&_.katex]:text-text-primary',
        className
      )}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};

export default KaTeXRenderer;
