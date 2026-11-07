// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from '../src/components/Header';
import type { Problem } from '../src/core/types';

const problem: Problem = { id: '1068', title: 'Weird Algorithm', category: 'Introductory Problems', timeLimit: '1 s', memoryLimit: '512 MB', statementHtml: '', testCases: [] };

describe('workspace header navigation', () => {
  let host: HTMLDivElement;
  let root: Root;
  const onOpenHelp = vi.fn();
  const onOpenAuth = vi.fn();
  const onOpenCsesAccount = vi.fn();
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    onOpenHelp.mockReset();
    onOpenAuth.mockReset();
    onOpenCsesAccount.mockReset();
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const render = () => act(() => root.render(<Header currentProblem={problem} allProblems={[problem]} categories={[]} solvedCount={0} totalProblems={1} onSelectProblem={vi.fn()} onOpenCommandPalette={vi.fn()} zenMode={false} onToggleZenMode={vi.fn()} onOpenSettings={vi.fn()} onOpenHelp={onOpenHelp} onOpenArchive={vi.fn()} onOpenAllNotes={vi.fn()} onOpenLists={vi.fn()} onOpenContestBank={vi.fn()} onOpenAuth={onOpenAuth} onOpenCsesAccount={onOpenCsesAccount} />));
  it('puts GitHub and CSES account actions under one visible Account control', () => {
    render();
    const account = [...host.querySelectorAll('details')].find(item => item.querySelector('summary[aria-label="Account options"]'))!;
    const trigger = account.querySelector<HTMLElement>('summary')!;
    expect(trigger.textContent).toContain('Account');
    act(() => trigger.click());
    const github = [...account.querySelectorAll('button')].find(button => button.textContent?.includes('GitHub'))!;
    const cses = [...account.querySelectorAll('button')].find(button => button.textContent?.includes('CSES'))!;
    expect(github).toBeTruthy();
    expect(cses).toBeTruthy();
    act(() => github.click());
    expect(onOpenAuth).toHaveBeenCalledOnce();
    expect(account.open).toBe(false);
    act(() => trigger.click());
    const connectedCses = [...account.querySelectorAll('button')].find(button => button.textContent?.includes('CSES'))!;
    act(() => connectedCses.click());
    expect(onOpenCsesAccount).toHaveBeenCalledOnce();
  });
  it('dismisses Account options on Escape and outside click', () => {
    render();
    const account = [...host.querySelectorAll('details')].find(item => item.querySelector('summary[aria-label="Account options"]'))!;
    const trigger = account.querySelector<HTMLElement>('summary')!;
    act(() => trigger.click());
    act(() => trigger.focus());
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(account.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    act(() => trigger.click());
    act(() => document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(account.open).toBe(false);
  });
  it('keeps secondary destinations inside an accessible More menu and returns focus after selection', () => {
    render();
    const menu = [...host.querySelectorAll('details')].find(item => item.querySelector('summary[aria-label="More workspace actions"]'))!;
    const summary = menu.querySelector<HTMLElement>('summary[aria-label="More workspace actions"]')!;
    expect(summary.getAttribute('aria-label')).toBe('More workspace actions');
    act(() => summary.click());
    expect(menu.open).toBe(true);
    const labels = menu.textContent || '';
    expect(labels).toContain('Archive'); expect(labels).toContain('Notes'); expect(labels).toContain('Contest bank'); expect(labels).toContain('Settings'); expect(labels).toContain('Keyboard shortcuts'); expect(labels).toContain('GitHub'); expect(labels).toContain('Feedback');
    const help = [...menu.querySelectorAll('button')].find(button => button.textContent?.includes('Keyboard shortcuts'))!;
    act(() => help.click());
    expect(onOpenHelp).toHaveBeenCalledOnce();
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });
  it('closes More on Escape and restores focus to its trigger', () => {
    render();
    const menu = [...host.querySelectorAll('details')].find(item => item.querySelector('summary[aria-label="More workspace actions"]'))!; const summary = menu.querySelector<HTMLElement>('summary[aria-label="More workspace actions"]')!;
    menu.open = true; act(() => summary.focus());
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });
});
