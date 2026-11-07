import { beforeEach, describe, expect, it, vi } from 'vitest';

const { csesRequest } = vi.hoisted(() => ({ csesRequest: vi.fn() }));
vi.mock('@/core/cses-network', () => ({ CSES_BASE_URL: 'https://cses.fi', csesRequest }));

import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/cses/history/route';

function req(query = '') {
  return new NextRequest(`https://local.test/api/cses/history${query}`, { headers: { 'x-cses-session': 'explicit-user-session' } });
}
const taskIndex = '<a class="account" href="/user/42">alice</a><a href="/problemset/task/1/">A</a><a href="/problemset/task/2/">B</a>';
const view = (id: string) => `<table><tr><td>2026-11-02 08:20:28</td><td>C++20</td><td>0.01 s</td><td>828 bytes</td><td class="task-score icon full"></td><td><a href="/problemset/result/${id}/">Result</a></td></tr></table>`;

describe('CSES personal history API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports missing timestamps as omissions and never claims full history', async () => {
    csesRequest.mockImplementation(async (url: string) => {
      if (url.endsWith('/problemset/')) return { statusCode: 200, body: taskIndex };
      if (url.includes('/problemset/view/1/')) return { statusCode: 200, body: view('123') };
      if (url.includes('/problemset/result/123/')) return { statusCode: 200, body: '<div>Submission time unavailable</div>' };
      return { statusCode: 200, body: view('456') };
    });
    const response = await GET(req('?limit=1'));
    const body = await response.json();
    expect(body).toMatchObject({ omittedCount: 1, complete: false, nextCursor: '2:0', entries: [] });
  });

  it('omits timestamps when the result page does not verify an accepted verdict', async () => {
    csesRequest.mockImplementation(async (url: string) => {
      if (url.endsWith('/problemset/')) return { statusCode: 200, body: taskIndex };
      if (url.includes('/problemset/view/1/')) return { statusCode: 200, body: view('123') };
      return { statusCode: 200, body: '<div>Submission time: 2026-11-02 08:20:28 +0200</div>' };
    });
    const body = await (await GET(req('?limit=1'))).json();
    expect(body).toMatchObject({ omittedCount: 1, complete: false, entries: [] });
  });

  it('resumes within the discovered task index and retains the explicit UTC offset', async () => {
    csesRequest.mockImplementation(async (url: string) => {
      if (url.endsWith('/problemset/')) return { statusCode: 200, body: taskIndex };
      if (url.includes('/problemset/view/1/')) return { statusCode: 200, body: view('123') };
      if (url.includes('/problemset/view/2/')) return { statusCode: 200, body: view('456') };
      return { statusCode: 200, body: '<div>Result: Accepted</div><div>Submission time is 2026-11-02 08:20:28 +0200</div>' };
    });
    const first = await (await GET(req('?limit=1'))).json();
    expect(first.nextCursor).toBe('2:0');
    const second = await (await GET(req(`?limit=1&cursor=${encodeURIComponent(first.nextCursor)}`))).json();
    expect(second).toMatchObject({ complete: true, omittedCount: 0, entries: [{ problemId: '2', submissionId: '456', csesUserId: '42', acceptedAt: '2026-11-02T06:20:28.000Z', utcOffsetMinutes: 120 }] });
  });
});
