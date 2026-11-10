// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TestBench } from '../src/components/TestBench';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('reports failed clipboard fallback and preserves success feedback when it works', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
  });
  const previousExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
  const execCommand = vi.fn().mockReturnValue(false);
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
  try {
    act(() => root.render(
      <TestBench
        testCases={[{ id: 'sample', input: '5', expectedOutput: '25', isSample: true }]}
        results={{}}
        activeTestCaseId="sample"
        onSelectTestCase={() => {}}
        onAddCustomTestCase={() => {}}
        onDeleteCustomTestCase={() => {}}
      />
    ));
    const copy = [...container.querySelectorAll('button')].find(button => button.textContent === 'Copy')!;
    await act(async () => copy.click());
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(copy.textContent).toBe('Copy');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Copy failed');
    expect(document.querySelector('body > textarea')).toBeNull();

    execCommand.mockReturnValue(true);
    await act(async () => copy.click());
    expect(copy.textContent).toBe('Copied');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
  } finally {
    act(() => root.unmount());
    container.remove();
    if (previousClipboard) Object.defineProperty(navigator, 'clipboard', previousClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
    if (previousExecCommand) Object.defineProperty(document, 'execCommand', previousExecCommand);
    else Reflect.deleteProperty(document, 'execCommand');
  }
});
