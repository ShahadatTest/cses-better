import { beforeEach, describe, expect, it, vi } from 'vitest';

const { csesRequest, getSharedCsesSession } = vi.hoisted(() => ({ csesRequest: vi.fn(), getSharedCsesSession: vi.fn() }));
vi.mock('@/core/cses-network', () => ({ CSES_BASE_URL: 'https://cses.fi', csesRequest, getSharedCsesSession }));
vi.mock('@/core/cses-user-cache', () => ({ registerUserMapping: vi.fn() }));

import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/cses/submissions/[id]/route';

function queueRow(id: string, userId: string, user: string, lang = 'C++20', runtime = '0.01 s') {
  return `<tr><td>2026-11-06 21:12:33</td><td><a href="/user/${userId}">${user}</a></td><td>${lang}</td><td>${runtime}</td><td>828 bytes</td><td class="task-score icon full"></td><td><a href="/problemset/hack/1068/entry/${id}/">Code</a></td></tr>`;
}

function req(url: string, session = true) {
  return new NextRequest(`https://local.test/api/cses/submissions/1068${url}`, { headers: session ? { 'x-cses-session': 'user-session' } : {} });
}

describe('CSES submissions API', () => {
  beforeEach(() => { vi.clearAllMocks(); getSharedCsesSession.mockResolvedValue('shared-session'); });

  it('uses CSES filters and returns only the requested accepted user and language', async () => {
    csesRequest.mockImplementation(async (url: string) => ({ statusCode: 200, body: url.includes('/queue/') ? `<table>${queueRow('5023767', '134297', 'mitcute')}${queueRow('5023768', '99', 'other', 'Rust')}</table>` : '' }));
    const response = await GET(req('?language=C%2B%2B20&verdict=ACCEPTED&sort=runtime_asc&user=mitcute'), { params: { id: '1068' } });
    const body = await response.json();
    const queueUrl = String(csesRequest.mock.calls.find(call => String(call[0]).includes('/queue/'))![0]);
    expect(new URL(queueUrl).searchParams.toString()).toBe('lang=3&status=2&by=1&order=0&user=mitcute');
    expect(body.submissions.map((s: any) => s.id)).toEqual(['5023767']);
    expect(body.submissions[0]).toMatchObject({ userId: '134297', language: 'C++20', status: 'ACCEPTED' });
  });

  it('follows the next numeric page, not a distant last-page link, preserving filters', async () => {
    csesRequest.mockImplementation(async (url: string) => ({ statusCode: 200, body: url.includes('/queue/') ? `<table>${queueRow(url.match(/queue\/1068\/(\d+)/)?.[1] || '1', '42', 'alice')}</table><a href="/problemset/queue/1068/2">2</a><a href="/problemset/queue/1068/3">3</a><a href="/problemset/queue/1068/19159">Last</a>` : '' }));
    await GET(req('?language=all&sort=time_desc'), { params: { id: '1068' } });
    const queueUrls = csesRequest.mock.calls.map(call => String(call[0])).filter(url => url.includes('/queue/'));
    expect(queueUrls.map(url => new URL(url).pathname)).toEqual(['/problemset/queue/1068/1', '/problemset/queue/1068/2', '/problemset/queue/1068/3']);
    expect(new URL(queueUrls[1]).searchParams.get('order')).toBe('1');
  });

  it('rejects malformed cursors and does not expose the shared bot as the user', async () => {
    const invalid = await GET(req('?cursor=https%3A%2F%2Fevil.test%2Fqueue%2F1', false), { params: { id: '1068' } });
    expect(invalid.status).toBe(400);
    csesRequest.mockResolvedValue({ statusCode: 200, body: `<table>${queueRow('12', '42', 'alice')}</table>` });
    const response = await GET(req('', false), { params: { id: '1068' } });
    const body = await response.json();
    expect(getSharedCsesSession).toHaveBeenCalledOnce();
    expect(body.currentUser).toBeUndefined();
    expect(body.mySubmissions).toEqual([]);
  });
});
