// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubmissionsTab } from '../src/components/SubmissionsTab';
import type { SubmissionRecord } from '../src/core/types';

describe('official and local submission history', () => {
  let root: Root;
  let host: HTMLDivElement;
  const local: SubmissionRecord = { id: 'local-1', problemId: '1068', code: 'local source', language: 'cpp', charCount: 12, timestamp: 1, status: 'AC', passedCount: 1, totalCount: 1, maxTimeMs: 12, maxMemoryBytes: 1024 };
  const official: SubmissionRecord = { ...local, id: 'cses-123', code: 'official source', source: 'cses', officialSubmissionId: '123', status: 'WA', passedCount: 0, totalCount: 1, maxTimeMs: 0, maxMemoryBytes: 0, officialResult: { submissionId: '123', status: 'WRONG ANSWER', rawStatusText: 'WRONG ANSWER', lifecycleStatus: 'FINISHED', tests: [{ index: 1, verdict: 'WRONG ANSWER', time: '0.01 s', input: '7', expectedOutput: '7 22', actualOutput: '999999' }], resultUrl: 'https://cses.fi/problemset/result/123/' } };
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ submissions: [], mySubmissions: [] }) })));
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    act(() => root.render(<SubmissionsTab submissions={[official, local]} problemId="1068" onSelectCode={() => {}} />));
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  const filter = (label: string) => act(() => [...host.querySelectorAll('button')].find(button => button.textContent?.includes(label))!.click());
  it('keeps official records out of local runs and local records out of the official filter', () => {
    expect(host.textContent).toContain('Saved Official CSES Results (1)');
    expect(host.textContent).toContain('Local Workbench Runs (1)');
    filter('Local Workbench');
    expect(host.textContent).not.toContain('Saved Official CSES Results');
    expect(host.textContent).toContain('12 ms');
    filter('Official CSES.fi');
    expect(host.textContent).toContain('Saved Official CSES Results (1)');
    expect(host.textContent).not.toContain('Local Workbench Runs');
  });
  it('reopens the real official failing test details without fabricating missing metrics', () => {
    filter('Official CSES.fi');
    act(() => host.querySelector<HTMLButtonElement>('button[title="View code"]')!.click());
    expect(host.textContent).toContain('WRONG ANSWER');
    expect(host.textContent).toContain('999999');
    expect(host.textContent).toContain('7 22');
    expect(host.textContent).toContain('official source');
    expect(host.textContent).not.toContain('local source');
    expect(host.textContent).not.toContain('0 ms');
    expect(host.querySelector('a[href="https://cses.fi/problemset/result/123/"]')).not.toBeNull();
  });
});
