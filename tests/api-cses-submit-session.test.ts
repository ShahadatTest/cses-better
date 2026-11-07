import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../src/core/cses-network', () => ({
  CSES_BASE_URL: 'https://cses.fi',
  csesRequest: request,
  extractCsrfToken: (html: string) => html.match(/csrf:([\w-]+)/)?.[1] || null,
  mapLanguageToCsesOption: () => 'C++',
}));

import { POST } from '../src/app/api/cses/submit/route';

const response = (body: string, statusCode = 200, extras: Record<string, unknown> = {}) => ({
  body, statusCode, headers: {}, cookies: 'PHPSESSID=refreshed', ...extras,
});
const submitRequest = (data: Record<string, unknown>) => new NextRequest('http://localhost/api/cses/submit', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problemId: '1068', language: 'cpp', code: 'int main(){}', ...data }),
});

describe('CSES submission using remembered personal sessions', () => {
  beforeEach(() => { request.mockReset(); });

  it('submits with the remembered personal session without another password login', async () => {
    request.mockImplementation(async (url: string, options: { method?: string; cookie?: string }) => {
      if (String(url).endsWith('/problemset/task/1068/')) return response('<a class="account" href="/user/42">alice</a><form>csrf:task-token</form>');
      if (String(url).endsWith('/course/send.php')) return response('', 302, { location: 'https://cses.fi/problemset/result/777/' });
      throw new Error(`Unexpected upstream request: ${options?.method || 'GET'} ${url}`);
    });

    const result = await POST(submitRequest({ nick: 'alice', sessionCookie: 'PHPSESSID=remembered123' }));
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ success: true, submissionId: '777', owner: { nick: 'alice', isPersonal: true } });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.every(([, options]) => options.cookie === 'PHPSESSID=remembered123')).toBe(true);
  });

  it('returns a reconnect prompt when the remembered session is expired and never switches accounts', async () => {
    request.mockResolvedValue(response('<form action="/login">Sign in</form>'));
    const result = await POST(submitRequest({ nick: 'alice', sessionCookie: 'PHPSESSID=expired123' }));
    expect(result.status).toBe(401);
    expect(await result.json()).toMatchObject({ success: false, error: expect.stringContaining('expired') });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][1].cookie).toBe('PHPSESSID=expired123');
    expect(request.mock.calls.some(([url]) => String(url).endsWith('/login'))).toBe(false);
  });

  it('rejects a remembered session when CSES identifies a different account', async () => {
    request.mockResolvedValue(response('<a class="account" href="/user/43">bob</a><form>csrf:task-token</form>'));
    const result = await POST(submitRequest({ nick: 'alice', userId: '42', sessionCookie: 'PHPSESSID=remembered123' }));
    expect(result.status).toBe(403);
    expect(await result.json()).toMatchObject({ success: false, error: expect.stringContaining('different account') });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
