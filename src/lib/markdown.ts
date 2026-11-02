import { renderMathFormula, sanitizeMathHtml } from '@/components/KaTeXRenderer';

export interface CodeBlockPlaceholder {
  lang: string;
  code: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalizes mainstream LLM output (ChatGPT, Claude, DeepSeek, Gemini):
 * - Converts LaTeX brackets \[ ... \] to $$ ... $$
 * - Converts LaTeX parentheses \( ... \) to $ ... $
 * - Normalizes Windows line returns
 */
export function normalizeLlmMarkdown(text: string): string {
  if (!text) return '';
  let out = text.replace(/\r\n/g, '\n');

  // Convert \[ display math \] to $$
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `$$\n${math.trim()}\n$$`);

  // Convert \( inline math \) to $
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  return out;
}

/**
 * Parses markdown tables into responsive, styled HTML tables.
 */
function parseMarkdownTables(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line looks like table header and next line is separator: |---|---|
    if (
      trimmed.startsWith('|') &&
      trimmed.endsWith('|') &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith('|') &&
      lines[i + 1].trim().endsWith('|') &&
      /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim())
    ) {
      const headerLine = trimmed;
      const sepLine = lines[i + 1].trim();
      const headers = headerLine
        .slice(1, -1)
        .split('|')
        .map((h) => h.trim());
      const aligns = sepLine
        .slice(1, -1)
        .split('|')
        .map((s) => {
          const t = s.trim();
          if (t.startsWith(':') && t.endsWith(':')) return 'center';
          if (t.endsWith(':')) return 'right';
          return 'left';
        });

      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const rowLine = lines[i].trim();
        const cells = rowLine
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        rows.push(cells);
        i++;
      }

      const tableHtml = `<div class="gfm-table-wrap my-3.5 overflow-x-auto rounded-lg border border-border-subtle bg-surface-1/70 shadow-xs">
  <table class="w-full min-w-full border-collapse text-left text-xs font-mono">
    <thead>
      <tr class="border-b border-border-subtle bg-surface-2/80 text-slate-200">
        ${headers
          .map(
            (h, idx) =>
              `<th class="px-3 py-2 font-semibold text-slate-200 border-r last:border-r-0 border-border-subtle/50" style="text-align: ${aligns[idx] || 'left'}">${h}</th>`
          )
          .join('')}
      </tr>
    </thead>
    <tbody class="divide-y divide-border-subtle/40">
      ${rows
        .map(
          (r, rIdx) =>
            `<tr class="${rIdx % 2 === 1 ? 'bg-surface-2/20' : 'bg-transparent'} hover:bg-surface-2/40 transition-colors">
              ${r
                .map(
                  (cell, cIdx) =>
                    `<td class="px-3 py-2 text-slate-300 border-r last:border-r-0 border-border-subtle/30" style="text-align: ${aligns[cIdx] || 'left'}">${cell}</td>`
                )
                .join('')}
            </tr>`
        )
        .join('')}
    </tbody>
  </table>
</div>`;

      result.push(tableHtml);
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join('\n');
}

/**
 * Top-tier GitHub-flavored Markdown (GFM) compiler with:
 * - GitHub alert callouts (> [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION])
 * - Full table support with alignment
 * - Syntax styled code blocks with language badge and copy button
 * - KaTeX math rendering ($...$ and $$...$$)
 * - Checklists, headings, quotes, lists, links, bold, italic, strikethrough
 */
export function compileGfmToHtml(rawMarkdown: string): string {
  if (!rawMarkdown || !rawMarkdown.trim()) return '';

  // 1. LLM normalization
  let text = normalizeLlmMarkdown(rawMarkdown);

  // 2. Extract code blocks: ```lang\n...```
  const codeBlocks: CodeBlockPlaceholder[] = [];
  text = text.replace(/```([a-zA-Z0-9_\-#+]*)\s*\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang: (lang || 'code').trim(), code });
    return `XGFMCODEBLOCKX${idx}XENDX`;
  });

  // 3. Extract display math: $$...$$
  const displayMathBlocks: string[] = [];
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    const idx = displayMathBlocks.length;
    displayMathBlocks.push(math.trim());
    return `XGFMDISPLAYMATHX${idx}XENDX`;
  });

  // 4. Extract inline math: $...$ (avoiding escaped \$)
  const inlineMathBlocks: string[] = [];
  text = text.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (match, prefix, math) => {
    const idx = inlineMathBlocks.length;
    inlineMathBlocks.push(math.trim());
    return `${prefix}XGFMINLINEMATHX${idx}XENDX`;
  });

  // 5. Extract inline code: `...`
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(code);
    return `XGFMINLINECODEX${idx}XENDX`;
  });

  // 6. GitHub Callout Alerts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
  text = text.replace(
    /^(?:> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n)((?:> [^\n]*\n?)+)/gim,
    (_, type, body) => {
      const alertType = type.toUpperCase();
      const content = body
        .split('\n')
        .map((l: string) => l.replace(/^>\s?/, ''))
        .filter((l: string) => l.trim() !== '')
        .join('<br />');

      let borderColor = 'border-sky-500';
      let bgColor = 'bg-sky-950/25';
      let titleColor = 'text-sky-400';
      let iconSvg = `<svg class="w-4 h-4 mr-1.5 inline-block shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-width="2" stroke-linecap="round" d="M12 16v-4m0-4h.01"/></svg>`;
      let label = 'Note';

      if (alertType === 'TIP') {
        borderColor = 'border-emerald-500';
        bgColor = 'bg-emerald-950/25';
        titleColor = 'text-emerald-400';
        iconSvg = `<svg class="w-4 h-4 mr-1.5 inline-block shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>`;
        label = 'Tip';
      } else if (alertType === 'IMPORTANT') {
        borderColor = 'border-purple-500';
        bgColor = 'bg-purple-950/25';
        titleColor = 'text-purple-400';
        iconSvg = `<svg class="w-4 h-4 mr-1.5 inline-block shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
        label = 'Important';
      } else if (alertType === 'WARNING') {
        borderColor = 'border-amber-500';
        bgColor = 'bg-amber-950/25';
        titleColor = 'text-amber-400';
        iconSvg = `<svg class="w-4 h-4 mr-1.5 inline-block shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
        label = 'Warning';
      } else if (alertType === 'CAUTION') {
        borderColor = 'border-rose-500';
        bgColor = 'bg-rose-950/25';
        titleColor = 'text-rose-400';
        iconSvg = `<svg class="w-4 h-4 mr-1.5 inline-block shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-2.98L13.74 4.54a2 2 0 00-3.48 0L3.33 16.02A2 2 0 005.07 19z"/></svg>`;
        label = 'Caution';
      }

      return `<div class="gfm-alert my-3.5 rounded-r-lg border-l-4 ${borderColor} ${bgColor} p-3.5 text-xs text-slate-300 shadow-xs">
  <div class="flex items-center font-semibold mb-1 ${titleColor}">
    ${iconSvg}
    <span>${label}</span>
  </div>
  <div class="leading-relaxed pl-5">${content}</div>
</div>`;
    }
  );

  // 7. Standard Blockquotes: > ...
  text = text.replace(/^(?:> (?!\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]).*(?:\n|$))+/gim, (match) => {
    const lines = match
      .split('\n')
      .map((l) => l.replace(/^>\s?/, ''))
      .filter((l) => l.trim() !== '');
    if (lines.length === 0) return '';
    return `<blockquote class="border-l-4 border-slate-600 bg-surface-2/40 px-3.5 py-2 my-2.5 rounded-r text-slate-300 italic text-sm leading-relaxed">${lines.join('<br />')}</blockquote>`;
  });

  // 8. Markdown Tables
  text = parseMarkdownTables(text);

  // 9. Headings
  text = text
    .replace(/^##### (.*$)/gim, '<h5 class="text-xs font-semibold text-slate-300 uppercase tracking-wider mt-3 mb-1.5">$1</h5>')
    .replace(/^#### (.*$)/gim, '<h4 class="text-xs font-bold text-slate-200 mt-4 mb-2">$1</h4>')
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-slate-100 mt-4 mb-2 pb-1 border-b border-border-subtle/50">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-base font-bold text-slate-100 mt-5 mb-2 pb-1 border-b border-border-subtle">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-lg font-bold text-slate-100 mt-6 mb-3 pb-1.5 border-b border-border-subtle">$1</h1>');

  // 10. Horizontal rules
  text = text.replace(/^(?:---|\*\*\*|___)\s*$/gim, '<hr class="my-4 border-border-subtle" />');

  // 11. Checklists (Task Lists)
  text = text
    .replace(/^- \[x\] (.*$)/gim, '<div class="flex items-start gap-2 my-1 text-slate-400 line-through"><input type="checkbox" checked disabled class="mt-1 h-3.5 w-3.5 rounded border-border-subtle bg-surface-2 accent-sky-500" /> <span>$1</span></div>')
    .replace(/^- \[ \] (.*$)/gim, '<div class="flex items-start gap-2 my-1 text-slate-300"><input type="checkbox" disabled class="mt-1 h-3.5 w-3.5 rounded border-border-subtle bg-surface-2 accent-sky-500" /> <span>$1</span></div>');

  // 12. Bullet Lists & Numbered Lists
  text = text.replace(/^(?:[-*+] (.*$)\n?)+/gim, (match) => {
    const items = match
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- ') || l.startsWith('* ') || l.startsWith('+ '))
      .map((l) => `<li class="text-slate-300 my-0.5 leading-relaxed">${l.replace(/^[-*+]\s+/, '')}</li>`)
      .join('');
    return items ? `<ul class="list-disc pl-5 my-2 space-y-0.5 text-sm">${items}</ul>` : '';
  });

  text = text.replace(/^(?:\d+\. (.*$)\n?)+/gim, (match) => {
    const items = match
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^\d+\.\s+/.test(l))
      .map((l) => `<li class="text-slate-300 my-0.5 leading-relaxed">${l.replace(/^\d+\.\s+/, '')}</li>`)
      .join('');
    return items ? `<ol class="list-decimal pl-5 my-2 space-y-0.5 text-sm">${items}</ol>` : '';
  });

  // 13. Inline Typography: Bold, Italic, Strikethrough
  text = text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-100">$1</strong>')
    .replace(/__(.*?)__/g, '<strong class="font-semibold text-slate-100">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-slate-200">$1</em>')
    .replace(/_(.*?)_/g, '<em class="italic text-slate-200">$1</em>')
    .replace(/~~(.*?)~~/g, '<del class="line-through text-slate-400">$1</del>');

  // 14. Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:text-sky-300 underline underline-offset-2">$1</a>');

  // 15. Paragraphs & Line Breaks
  const blocks = text.split(/\n{2,}/);
  text = blocks
    .map((block) => {
      const b = block.trim();
      if (!b) return '';
      if (
        b.startsWith('<h1') ||
        b.startsWith('<h2') ||
        b.startsWith('<h3') ||
        b.startsWith('<h4') ||
        b.startsWith('<h5') ||
        b.startsWith('<blockquote') ||
        b.startsWith('<ul') ||
        b.startsWith('<ol') ||
        b.startsWith('<div class="gfm-table') ||
        b.startsWith('<div class="gfm-alert') ||
        b.startsWith('<div class="flex items-start') ||
        b.startsWith('<hr') ||
        b.startsWith('XGFMCODEBLOCKX') ||
        b.startsWith('XGFMDISPLAYMATHX')
      ) {
        return b;
      }
      return `<p class="my-2 leading-relaxed text-sm text-slate-300">${b.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  // 16. Restore inline codes
  text = text.replace(/XGFMINLINECODEX(\d+)XENDX/g, (_, idx) => {
    const code = inlineCodes[Number(idx)] || '';
    const escaped = escapeHtml(code);
    return `<code class="bg-surface-2 px-1.5 py-0.5 rounded text-xs font-mono text-amber-300 border border-border-subtle/70">${escaped}</code>`;
  });

  // 17. Restore code blocks with language badge and copy button
  text = text.replace(/XGFMCODEBLOCKX(\d+)XENDX/g, (_, idx) => {
    const item = codeBlocks[Number(idx)];
    if (!item) return '';
    const lang = item.lang.toUpperCase() || 'CODE';
    const escaped = escapeHtml(item.code);
    return `<div class="code-block my-3 rounded-lg overflow-hidden border border-border-subtle bg-[#0d1117] shadow-sm">
  <div class="flex items-center justify-between px-3 py-1.5 bg-surface-2/80 text-[11px] font-mono text-slate-400 border-b border-border-subtle select-none">
    <div class="flex items-center gap-1.5">
      <span class="inline-block w-2.5 h-2.5 rounded-full bg-rose-500/50"></span>
      <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-500/50"></span>
      <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500/50"></span>
      <span class="ml-2 font-semibold text-slate-300 text-[10px] tracking-wide">${lang}</span>
    </div>
    <button type="button" class="code-copy-btn flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-slate-100 hover:bg-surface-3 transition-colors cursor-pointer" title="Copy code">
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke-width="2"/><path stroke-width="2" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      <span class="copy-text">Copy</span>
    </button>
  </div>
  <pre class="p-3.5 text-xs font-mono overflow-x-auto text-slate-100 leading-relaxed"><code>${escaped}</code></pre>
</div>`;
  });

  // 18. Restore & render KaTeX display math
  text = text.replace(/XGFMDISPLAYMATHX(\d+)XENDX/g, (_, idx) => {
    const math = displayMathBlocks[Number(idx)] || '';
    return renderMathFormula(math, true);
  });

  // 19. Restore & render KaTeX inline math
  text = text.replace(/XGFMINLINEMATHX(\d+)XENDX/g, (_, idx) => {
    const math = inlineMathBlocks[Number(idx)] || '';
    return renderMathFormula(math, false);
  });

  // 20. Sanitize via DOMPurify
  return sanitizeMathHtml(text);
}
