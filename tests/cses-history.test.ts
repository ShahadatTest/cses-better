import { describe, expect, it } from 'vitest';
import { nextQueuePageLink, normalizeCsesLanguage, parseOfficialAcceptedStatus, parseQueueRows, parseSubmissionTimestamp, queuePageLinks } from '../src/core/cses-history';

describe('CSES history parsing', () => {
  it('keeps the official numeric entry id and status from queue markup', () => {
    const html = '<table><tr><td>2025-02-03 12:30</td><td><a href="/user/42">alice</a></td><td>C++</td><td>0.01 s</td><td>100 bytes</td><td class="task-score icon full"></td><td><a href="/problemset/hack/1068/entry/98765/">Code</a></td></tr></table>';
    expect(parseQueueRows(html, '1068')).toEqual([expect.objectContaining({ id: '98765', user: 'alice', userId: '42', language: 'C++', status: 'ACCEPTED' })]);
  });

  it('follows only same-origin links discovered as CSES queue links', () => {
    expect(queuePageLinks('<a href="/problemset/queue/1068/?page=2">Next</a><a href="/problemset/queue/1084/">Other</a><a href="https://evil.example/problemset/queue/1068/">x</a>', 'https://cses.fi/problemset/queue/1068/', '1068')).toEqual(['https://cses.fi/problemset/queue/1068/?page=2']);
  });

  it('advances through the next page instead of jumping to the last link', () => {
    const html = '<a href="/problemset/queue/1068/2">2</a><a href="/problemset/queue/1068/3">3</a><a href="/problemset/queue/1068/19159">Last</a>';
    expect(nextQueuePageLink(html, 'https://cses.fi/problemset/queue/1068/1', '1068')).toBe('https://cses.fi/problemset/queue/1068/2');
  });

  it('normalizes versioned CSES languages and treats zero points as FAILED', () => {
    expect(normalizeCsesLanguage('C++20')).toBe('c++');
    const failed = parseQueueRows('<tr><td>2026-11-06 21:12</td><td>alice</td><td>Rust</td><td>--</td><td>--</td><td class="task-score icon zero"></td><td></td></tr>', '1068');
    expect(failed[0].status).toBe('FAILED');
  });

  it('keeps the explicit offset from the official result page timestamp', () => {
    expect(parseSubmissionTimestamp('<tr><th>Submission time</th><td>2026-11-02 08:20:28 +0200</td></tr>')).toEqual({ acceptedAt: '2026-11-02T06:20:28.000Z', utcOffsetMinutes: 120 });
    expect(parseSubmissionTimestamp('<div>Submission time: 2026-11-02 08:20:28</div>')).toBeNull();
  });

  it('rejects result pages with an explicit non-accepted verdict', () => {
    expect(parseOfficialAcceptedStatus('<span>Result: Accepted</span>')).toBe(true);
    expect(parseOfficialAcceptedStatus('<td class="task-score icon zero"></td>')).toBe(false);
    expect(parseOfficialAcceptedStatus('<div>Submission time: 2026-11-02 08:20:28 +0200</div>')).toBeNull();
  });
});
