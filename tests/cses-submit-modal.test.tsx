// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { submitMock, pollMock } = vi.hoisted(() => ({ submitMock: vi.fn(), pollMock: vi.fn() }));
vi.mock('@/core/cses-client', () => ({
  getStoredCsesCredentials: () => null,
  saveStoredCsesCredentials: vi.fn(),
  submitToCses: submitMock,
  pollCsesVerdict: pollMock,
}));
vi.mock('@/core/storage', () => ({ saveSubmission: vi.fn() }));

import { CsesSubmitModal } from '../src/components/CsesSubmitModal';

describe('CSES submit modal cancellation', () => {
  let host: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    submitMock.mockReset();
    pollMock.mockReset();
    onClose.mockReset();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('does not start polling if the modal closes while submission is in flight', async () => {
    let finishSubmit!: (value: { success: boolean; submissionId: string }) => void;
    submitMock.mockReturnValue(new Promise((resolve) => { finishSubmit = resolve; }));
    await act(async () => {
      root.render(<CsesSubmitModal isOpen onClose={onClose} problemId="1068" problemTitle="Weird Algorithm" language="cpp" code="int main(){}" />);
    });
    const button = (text: string) => [...host.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!;
    act(() => button('Shared Bot').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => button('Submit to CSES').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(submitMock).toHaveBeenCalledTimes(1);

    act(() => host.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishSubmit({ success: true, submissionId: '123' });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(pollMock).not.toHaveBeenCalled();
  });

  it('does not start polling if the selected problem changes while submission is in flight', async () => {
    let finishSubmit!: (value: { success: boolean; submissionId: string }) => void;
    submitMock.mockReturnValue(new Promise((resolve) => { finishSubmit = resolve; }));
    const props = { isOpen: true, onClose, problemId: '1068', problemTitle: 'Weird Algorithm', language: 'cpp' as const, code: 'int main(){}' };
    await act(async () => { root.render(<CsesSubmitModal {...props} />); });
    const button = (text: string) => [...host.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!;
    act(() => button('Shared Bot').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => button('Submit to CSES').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => { root.render(<CsesSubmitModal {...props} problemId="1083" problemTitle="Digit Queries" />); });
    await act(async () => {
      finishSubmit({ success: true, submissionId: '123' });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(pollMock).not.toHaveBeenCalled();
  });
});
