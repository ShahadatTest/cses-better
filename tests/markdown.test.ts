import { describe, it, expect } from 'vitest';
import { compileGfmToHtml, normalizeLlmMarkdown } from '../src/lib/markdown';

describe('GitHub-flavored Markdown (GFM) compiler', () => {
  it('normalizes mainstream LLM bracket math into standard KaTeX dollar math', () => {
    const llmInput = 'Here is the recurrence:\n\\[ dp[i] = dp[i-1] + dp[i-2] \\]\nwhere \\( n \\le 10^5 \\).';
    const normalized = normalizeLlmMarkdown(llmInput);
    expect(normalized).toContain('$$');
    expect(normalized).toContain('$n \\le 10^5$');
  });

  it('compiles GitHub alerts with custom icon and colors', () => {
    const input = `> [!NOTE]
> Make sure to use fast I/O in C++.

> [!WARNING]
> Integer overflow if using 32-bit int.`;
    const html = compileGfmToHtml(input);
    expect(html).toContain('Note');
    expect(html).toContain('Warning');
    expect(html).toContain('gfm-alert');
    expect(html).toContain('border-sky-500');
    expect(html).toContain('border-amber-500');
  });

  it('compiles GFM tables with headers and cell alignment', () => {
    const tableMd = `| Method | Time | Space |
| :--- | :---: | ---: |
| DP | $O(N)$ | $O(N)$ |
| Greedy | $O(N \\log N)$ | $O(1)$ |`;
    const html = compileGfmToHtml(tableMd);
    expect(html).toContain('<table');
    expect(html).toContain('Method');
    expect(html).toContain('Greedy');
    expect(html).toContain('style="text-align: center"');
    expect(html).toContain('style="text-align: right"');
    expect(html).toContain('katex');
  });

  it('compiles task lists with checkboxes', () => {
    const checklist = `- [ ] Handle $N = 1$
- [x] Tested with large bounds`;
    const html = compileGfmToHtml(checklist);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('line-through');
  });

  it('renders code blocks with language header and copy button', () => {
    const code = `\`\`\`cpp
#include <iostream>
int main() { return 0; }
\`\`\``;
    const html = compileGfmToHtml(code);
    expect(html).toContain('CPP');
    expect(html).toContain('code-copy-btn');
    expect(html).toContain('#include &lt;iostream&gt;');
  });

  it('renders inline math and display math cleanly without mangling asterisks or subscripts', () => {
    const math = 'Let $a_i * b_i < 10^9$ and $$\\sum_{i=1}^n x_i$$';
    const html = compileGfmToHtml(math);
    expect(html).toContain('katex');
    expect(html).toContain('katex-display');
  });
});
