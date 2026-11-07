import { describe, expect, it } from 'vitest';
import { parseCsesResult, trustedCsesDetailUrl } from './cses-result-parser';

describe('parseCsesResult', () => {
  it('keeps lifecycle state separate from verdict and does not infer acceptance', () => {
    expect(parseCsesResult('<table><tr><td>Status:</td><td>READY</td></tr></table>')).toMatchObject({
      status: 'PENDING', lifecycleStatus: 'READY',
    });
    expect(parseCsesResult('<table><tr><td>Status:</td><td>Testing</td></tr></table>')).toMatchObject({
      status: 'TESTING', lifecycleStatus: 'TESTING',
    });
    expect(parseCsesResult('<html><pre>just source code</pre></html>')).toMatchObject({
      status: 'UNKNOWN', lifecycleStatus: 'UNKNOWN',
    });
  });

  it.each([['WRONG ANSWER', 'WRONG ANSWER'], ['ACCEPTED', 'ACCEPTED']])('uses final Result %s even while lifecycle says READY', (finalResult, expected) => {
    expect(parseCsesResult(`<table><tr><td>Status:</td><td><span id="status">READY</span></td></tr><tr><td>Result:</td><td><span>${finalResult}</span></td></tr></table>`)).toMatchObject({
      status: expected, lifecycleStatus: 'FINISHED',
    });
  });

  it.each([
    ['Accepted', 'ACCEPTED'], ['Memory limit exceeded', 'MEMORY LIMIT EXCEEDED'],
    ['Output limit exceeded', 'OUTPUT LIMIT EXCEEDED'], ['Wrong answer', 'WRONG ANSWER'],
  ])('maps final result %s', (input, status) => {
    expect(parseCsesResult(`<table><tr><td>Result:</td><td>${input}</td></tr></table>`).status).toBe(status);
  });

  it('reads labeled details and preserves source whitespace', () => {
    const parsed = parseCsesResult('<table><tr><td>Result:</td><td>Accepted</td></tr><tr><td>Total time:</td><td>0.01 s</td></tr></table><pre class="prettyprint">int main() {\n  return 0;\n}</pre>');
    expect(parsed.totalTime).toBe('0.01 s');
    expect(parsed.code).toBe('int main() {\n  return 0;\n}');
  });

  it('extracts only inline test data rendered by CSES', () => {
    const parsed = parseCsesResult('<table><tr><td>1</td><td>WRONG ANSWER</td><td>0.01 s</td></tr></table><h4 id="test1">Test 1</h4><p>Verdict:<span>WRONG ANSWER</span></p><table><tr><th>input</th></tr><tr><td><samp>7\n  2</samp></td></tr><tr><th>correct output</th></tr><tr><td><samp>7</samp></td></tr><tr><th>user output</th></tr><tr><td><samp>truncated...</samp></td></tr></table><a href="/view/1/token">View</a>');
    expect(parsed.tests).toEqual([{ index: 1, verdict: 'WRONG ANSWER', time: '0.01 s', memory: undefined, input: '7\n  2', expectedOutput: '7', actualOutput: 'truncated...', detailsUrl: '/view/1/token' }]);
  });

  it('uses the timestamp published by CSES, including its timezone', () => {
    const parsed = parseCsesResult('<table><tr><td>Submission time:</td><td>2026-11-02 08:20:28 +0200</td></tr></table>');
    expect(parsed.timestamp).toBe(Date.parse('2026-11-02T08:20:28+02:00'));
  });

  it('keeps CSES direct detail paths without assuming their file kind matches the test number', () => {
    const href = '/view/1/10159baf262b43a92d95db59dae1f72c645127301661e0a3ce4e38b295a97c58';
    expect(trustedCsesDetailUrl(href, 'https://cses.fi')).toBe(`https://cses.fi${href}`);
    expect(trustedCsesDetailUrl('https://evil.example/view/1/hash', 'https://cses.fi')).toBeUndefined();
    expect(trustedCsesDetailUrl('//evil.example/view/1/hash', 'https://cses.fi')).toBeUndefined();
  });
});
