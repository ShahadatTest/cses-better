import { afterEach, describe, expect, it, vi } from 'vitest';
import { pollCsesVerdict } from './cses-client';

const response = (status: string, lifecycleStatus: string) => ({
  ok: true,
  json: async () => ({ submissionId: '123', status, lifecycleStatus, rawStatusText: status, tests: [], resultUrl: '' }),
});

afterEach(() => vi.unstubAllGlobals());

describe('pollCsesVerdict', () => {
  it('continues polling READY and unknown results until a confirmed final result', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response('PENDING', 'READY')).mockResolvedValueOnce(response('UNKNOWN', 'UNKNOWN')).mockResolvedValueOnce(response('ACCEPTED', 'FINISHED'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await pollCsesVerdict('123', undefined, 3, 0);
    expect(result.status).toBe('ACCEPTED');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns UNKNOWN on timeout instead of treating missing verdict as failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('PENDING', 'READY')));
    const result = await pollCsesVerdict('123', undefined, 1, 0);
    expect(result.status).toBe('UNKNOWN');
  });

  it('stops immediately on a verified final verdict even when CSES lifecycle was READY', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('WRONG ANSWER', 'FINISHED'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await pollCsesVerdict('123', undefined, 4, 0);
    expect(result.status).toBe('WRONG ANSWER');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never treats UNKNOWN as a final verdict even if the lifecycle says FINISHED', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('UNKNOWN', 'FINISHED'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await pollCsesVerdict('123', undefined, 2, 0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.rawStatusText).toContain('Timed out');
  });

  it.each([401, 403])('surfaces expired or inaccessible sessions on HTTP %i without waiting for a judging timeout', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
    const result = await pollCsesVerdict('123', undefined, 4, 0);
    expect(result.status).toBe('UNKNOWN');
    expect(result.rawStatusText).toContain('Reconnect your CSES account');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves the last network failure instead of reporting a judge timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket closed')));
    const result = await pollCsesVerdict('123', undefined, 2, 0);
    expect(result.status).toBe('UNKNOWN');
    expect(result.rawStatusText).toContain('Could not reach the CSES result endpoint: socket closed');
  });

  it('removes the abort listener when a polling delay is canceled', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('PENDING', 'READY')));
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const pending = pollCsesVerdict('123', undefined, 2, 60_000, undefined, undefined, controller.signal);
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await pending;
    expect(add).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});
