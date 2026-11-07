import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('@/core/cses-network', () => ({
  csesRequest: requestMock,
  CSES_BASE_URL: 'https://cses.fi',
  getSharedCsesSession: async () => 'shared-session',
}));

import { GET } from './route';

afterEach(() => requestMock.mockReset());

describe('CSES result route test detail links', () => {
  it('preserves CSES /view/ file links independently of the test index and rejects offsite links', async () => {
    requestMock.mockResolvedValue({ statusCode: 200, body: `
      <table><tr><td>Status:</td><td>READY</td></tr><tr><td>Result:</td><td>Wrong answer</td></tr></table>
      <h4 id="test14">Test 14</h4><p>Verdict:<span>Wrong answer</span></p>
      <a href="/view/1/10159baf262b43a92d95db59dae1f72c645127301661e0a3ce4e38b295a97c58">input</a>
      <a href="https://evil.example/view/2/hash">output</a>
      <table><tr><th>input</th></tr><tr><td><samp>1</samp></td></tr></table>` });
    const response = await GET(new NextRequest('http://localhost/api/cses/result/123?problemId=1068'), { params: { id: '123' } });
    const result = await response.json();
    expect(result.tests[0]).toMatchObject({ index: 14, detailsUrl: 'https://cses.fi/view/1/10159baf262b43a92d95db59dae1f72c645127301661e0a3ce4e38b295a97c58', input: '1' });
    expect(result.tests[0].detailsUrl).not.toContain('evil.example');
  });
});
