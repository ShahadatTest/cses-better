// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AskAiMenu } from '../src/components/AskAiMenu';

describe('Ask AI handoff', () => {
  let host: HTMLDivElement;
  let root: Root;
  const writeText = vi.fn();
  const context = { title: 'Task', sourceUrl: 'https://cses.fi/problemset/task/1/', statement: 'Find a path.' };
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    localStorage.clear();
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const render = () => act(() => root.render(<AskAiMenu problem={context} code="secret draft" language="cpp" />));
  const choose = async (name = 'ChatGPT') => {
    const link = [...host.querySelectorAll('a')].find(a => a.textContent?.includes(name))!;
    // Keep jsdom from trying to navigate while exercising the click handler.
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    await act(async () => { link.click(); });
    return link;
  };
  it('opens Grok with the full context, keeps draft private by default, and also copies it', async () => {
    render(); const link = await choose();
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain('Find a path.');
    expect(writeText.mock.calls[0][0]).not.toContain('secret draft');
    expect(link.target).toBe('_blank'); expect(link.rel).toContain('noopener');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Prompt copied');
  });
  it('adds code to Grok only when selected and retains the full copied prompt', async () => {
    render();
    const grok = await choose('Grok');
    expect(new URL(grok.href).searchParams.get('q')).not.toContain('secret draft');
    act(() => host.querySelector('input')!.click());
    const codedGrok = host.querySelector<HTMLAnchorElement>('a[href^="https://grok.com/?q="]')!;
    expect(new URL(codedGrok.href).searchParams.get('q')).toContain('secret draft');
    codedGrok.addEventListener('click', event => event.preventDefault(), { once: true });
    await act(async () => { codedGrok.click(); });
    expect(writeText.mock.calls.at(-1)?.[0]).toContain('secret draft');
  });
  it('includes the current code only after opting in', async () => {
    render(); act(() => host.querySelector('input')!.click()); await choose('Claude');
    expect(writeText.mock.calls[0][0]).toContain('secret draft');
    expect(localStorage.getItem('cses_ai_provider')).toBe('claude');
  });
  it('offers selectable prompt text when clipboard access is denied', async () => {
    writeText.mockRejectedValue(new Error('Denied')); render(); await choose('Gemini');
    expect(host.querySelector('textarea')?.value).toContain('Find a path.');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('blocked');
  });
  it('offers Claude Desktop as an optional custom link and remembers its use', async () => {
    render();
    const link = [...host.querySelectorAll<HTMLAnchorElement>('a')].find(a => a.textContent?.includes('Open Claude Desktop'))!;
    expect(link.href).toMatch(/^claude:\/\/claude\.ai\/new\?q=/);
    expect(link.target).toBe('');
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    await act(async () => { link.click(); });
    expect(localStorage.getItem('cses_ai_provider')).toBe('claude-desktop');
    expect(writeText).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Open Claude DesktopLast used');
  });
  it('closes the native menu with Escape and restores focus', () => {
    render(); const details = host.querySelector('details')!; details.open = true;
    act(() => details.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(details.open).toBe(false); expect(document.activeElement).toBe(host.querySelector('summary'));
  });
});
