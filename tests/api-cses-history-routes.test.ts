import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { request, shared } = vi.hoisted(() => ({ request: vi.fn(), shared: vi.fn(async () => 'shared-test-session') }));
vi.mock('../src/core/cses-network', () => ({ CSES_BASE_URL: 'https://cses.fi', csesRequest: request, getSharedCsesSession: shared }));
import { GET as queue } from '../src/app/api/cses/submissions/[id]/route';
import { GET as history } from '../src/app/api/cses/history/route';

const response = (body: string, statusCode = 200) => ({ body, statusCode });
const row = '<tr><td>2022-11-25 15:57:43</td><td><a href="/user/42">alice</a></td><td>C++</td><td>0.00 s</td><td>100 ch.</td><td class="task-score icon full"></td><td><a href="/problemset/hack/1068/entry/12345/">code</a></td></tr>';
const req = (query = '', session = false) => new NextRequest(`http://localhost/api/cses/submissions/1068${query}`, { headers: session ? { 'x-cses-session': 'personal-test-session' } : {} });

describe('historical CSES queue API', () => {
  beforeEach(() => { request.mockReset(); shared.mockClear(); });
  it('rejects invalid task ids without requesting CSES', async () => {
    expect((await queue(req(), { params: { id: '../bad' } })).status).toBe(400);
    expect(request).not.toHaveBeenCalled();
  });
  it('sends real CSES runtime and accepted filters to find an older submission', async () => {
    request.mockImplementation(async (url: string) => response(url.includes('/queue/') ? `<table>${row}</table>` : ''));
    const data = await (await queue(req('?language=c%2B%2B&verdict=ACCEPTED&user=alice&sort=runtime_asc'), { params: { id: '1068' } })).json();
    const upstream = new URL(request.mock.calls.find(([url]) => url.includes('/queue/'))![0]);
    expect(Object.fromEntries(upstream.searchParams)).toMatchObject({ lang: '3', status: '2', by: '1', order: '0', user: 'alice' });
    expect(data.submissions[0]).toMatchObject({ id: '12345', time: '2022-11-25 15:57:43', status: 'ACCEPTED', runtime: '0.00 s' });
  });
  it('continues to the next discovered page instead of jumping to the last pager link', async () => {
    request.mockImplementation(async (url: string) => {
      const page = Number(new URL(url).pathname.match(/\/queue\/1068\/(\d+)/)?.[1]);
      return response(page ? `<a href="/problemset/queue/1068/${page + 1}">next</a><a href="/problemset/queue/1068/999">last</a>` : '');
    });
    const data = await (await queue(req('?sort=time_desc'), { params: { id: '1068' } })).json();
    const pages = request.mock.calls.map(([url]) => new URL(url).pathname).filter(p => p.includes('/queue/'));
    expect(pages).toEqual(['/problemset/queue/1068/1', '/problemset/queue/1068/2', '/problemset/queue/1068/3']);
    expect(new URL(data.historyCursor).pathname).toBe('/problemset/queue/1068/4');
    expect(data.historicalCoverage).toBe('partial');
  });
  it('never labels shared-account personal history as the viewer’s own', async () => {
    const personal = '<a class="account" href="/user/99">shared</a><tr><td>2026-01-01 00:00:00</td><td>C++</td><td>0.1 s</td><td>10 ch.</td><td class="task-score icon full"></td><td><a href="/problemset/result/333/">details</a></td></tr>';
    request.mockImplementation(async (url: string) => response(url.includes('/view/') ? personal : `<table>${row}</table>`));
    const data = await (await queue(req(), { params: { id: '1068' } })).json();
    expect(data.mySubmissions).toEqual([]);
    expect(data.currentUser).toBeUndefined();
    expect(data.submissions.some((s: { id: string }) => s.id === '333')).toBe(false);
  });
  it('keeps requests on the supplied personal session and rejects foreign cursors', async () => {
    request.mockResolvedValue(response(''));
    await queue(req('', true), { params: { id: '1068' } });
    expect(shared).not.toHaveBeenCalled();
    expect(request.mock.calls.every(([, options]) => options.cookie === 'personal-test-session')).toBe(true);
    const result = await queue(req('?cursor=https%3A%2F%2Fevil.example%2Fproblemset%2Fqueue%2F1068%2F2', true), { params: { id: '1068' } });
    expect(result.status).toBe(400);
    expect(request.mock.calls.every(([url]) => new URL(url).hostname === 'cses.fi')).toBe(true);
  });
});

describe('personal streak history API', () => {
  beforeEach(() => request.mockReset());
  it('requires an explicit connected session and does not use the shared account', async () => {
    const result = await history(new NextRequest('http://localhost/api/cses/history'));
    expect(result.status).toBe(401); expect(request).not.toHaveBeenCalled();
  });
});
