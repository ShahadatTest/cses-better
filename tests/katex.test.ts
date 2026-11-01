import { describe, it, expect } from 'vitest';
import {
  renderKatexInHtml,
  renderMathFormula,
} from '../src/components/KaTeXRenderer';

describe('KaTeXRenderer logic', () => {
  it('renders a simple inline LaTeX formula to HTML with MathML', () => {
    const result = renderMathFormula('1 \\le n \\le 10^6', false);
    expect(result).toContain('katex');
    expect(result).toContain('10');
    expect(result).toContain('6');
  });

  it('renders display mode formula', () => {
    const result = renderMathFormula('x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', true);
    expect(result).toContain('katex-display');
  });

  it('handles invalid LaTeX gracefully without throwing', () => {
    expect(() => {
      const result = renderMathFormula('\\invalidMacro{something', false);
      expect(result).toBeDefined();
    }).not.toThrow();
  });

  it('decodes HTML entities before passing to KaTeX', () => {
    const result = renderMathFormula('1 &le; n &lt; 100', false);
    expect(result).toContain('katex');
  });

  it('replaces CSES span math tags', () => {
    const html = '<p>Number <span class="math math-inline">n</span> and sequence <span class="math math-display">3 \\rightarrow 10</span>.</p>';
    const rendered = renderKatexInHtml(html);
    expect(rendered).toContain('katex');
    expect(rendered).not.toContain('<span class="math math-inline">');
    expect(rendered).not.toContain('<span class="math math-display">');
  });

  it('replaces dollar sign math delimiters', () => {
    const text = 'Algorithm takes $O(n \\log n)$ time and $$\\sum_{i=1}^n i$$ space.';
    const rendered = renderKatexInHtml(text);
    expect(rendered).toContain('katex');
    expect(rendered).toContain('katex-display');
  });

  it('renders raw latex when defaultInline is true and no tags exist', () => {
    const formula = '1 \\le n \\le 2 \\cdot 10^5';
    const rendered = renderKatexInHtml(formula, true);
    expect(rendered).toContain('katex');
  });
});
