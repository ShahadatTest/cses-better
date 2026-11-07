import { CSES_BASE_URL } from './cses-network';

export interface CsesHistoryEntry {
  problemId: string;
  submissionId: string;
  csesUserId: string;
  acceptedAt: string;
  utcOffsetMinutes: number;
}

export interface CsesHistoryResponse {
  entries: CsesHistoryEntry[];
  nextCursor: string | null;
  complete: boolean;
  omittedCount: number;
}

export function decodeCsesHtml(value: string): string {
  return value.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'");
}

export function parseSubmissionTimestamp(html: string): Pick<CsesHistoryEntry, 'acceptedAt' | 'utcOffsetMinutes'> | null {
  const visible = decodeCsesHtml(html.replace(/<[^>]*>/g, ' '));
  const stamp = visible.match(/Submission\s+time\s*(?:is|:)?\s*([0-9]{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4})/i)?.[1];
  if (!stamp) return null;
  const timestamp = stamp.replace(/\s+([+-]\d{2})(\d{2})$/, '$1:$2');
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return null;
  const zone = timestamp.match(/([+-])(\d{2}):(\d{2})$/)!;
  return { acceptedAt: new Date(parsed).toISOString(), utcOffsetMinutes: (zone[1] === '+' ? 1 : -1) * (Number(zone[2]) * 60 + Number(zone[3])) };
}

export function parseQueueRows(html: string, problemId: string) {
  const rows: { id: string; user: string; userId?: string; time: string; language: string; runtime: string; size: string; status: string; resultUrl: string }[] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 6) continue;
    const text = (s: string) => decodeCsesHtml(s.replace(/<[^>]*>/g, '').trim());
    const userLink = cells[1][2].match(/href="\/user\/(\d+)\/?"[^>]*>([\s\S]*?)<\/a>/i);
    const lang = text(cells[2][2]);
    const time = text(cells[0][2]);
    const score = cells.find(c => /task-score/i.test(c[1]));
    const verdict = score?.[1].match(/icon\s+([^\s"]+)/i)?.[1] || '';
    const linkedId = row[1].match(/href="[^"]*(?:entry|result)\/(\d+)\/?"/i)?.[1];
    if (!/^\d{1,4}-\d{2}-\d{2}/.test(time) || !lang) continue;
    rows.push({ id: linkedId || '', user: userLink ? text(userLink[2]) : text(cells[1][2]) || 'Anonymous', userId: userLink?.[1], time, language: lang, runtime: text(cells[3][2]), size: text(cells[4][2]), status: verdict.includes('full') ? 'ACCEPTED' : verdict.includes('zero') ? 'FAILED' : verdict.toUpperCase(), resultUrl: linkedId ? `${CSES_BASE_URL}/problemset/hack/${problemId}/entry/${linkedId}/` : '' });
  }
  return rows;
}

export function queuePageLinks(html: string, currentUrl: string, problemId: string): string[] {
  const base = new URL(CSES_BASE_URL);
  return [...html.matchAll(/href="([^"]+)"/gi)].map(m => m[1])
    .map(href => { try { return new URL(href, currentUrl); } catch { return null; } })
    .filter((url): url is URL => !!url && url.origin === base.origin && url.pathname.startsWith(`/problemset/queue/${problemId}/`))
    .map(url => url.toString());
}

export function nextQueuePageLink(html: string, currentUrl: string, problemId: string): string | null {
  const currentPage = Number(new URL(currentUrl).pathname.match(/\/(\d+)\/?$/)?.[1]);
  const pages = queuePageLinks(html, currentUrl, problemId).filter(link => Number(new URL(link).pathname.match(/\/(\d+)\/?$/)?.[1]) > currentPage);
  pages.sort((a, b) => Number(new URL(a).pathname.match(/\/(\d+)\/?$/)?.[1]) - Number(new URL(b).pathname.match(/\/(\d+)\/?$/)?.[1]));
  return pages[0] || null;
}

export function normalizeCsesLanguage(language: string): string {
  const value = language.toLowerCase();
  if (value.includes('c++') || value.includes('cpp')) return 'c++';
  if (value.includes('python') || value.includes('pypy')) return 'python';
  if (value.includes('java')) return 'java';
  if (value.includes('rust')) return 'rust';
  if (value.includes('node') || value.includes('javascript')) return 'javascript';
  if (value === 'c') return 'c';
  return value;
}

export function parseOfficialAcceptedStatus(html: string): boolean | null {
  const score = html.match(/class="[^"]*task-score[^\"]*icon\s+([^\s\"]+)/i)?.[1];
  if (score) return score.includes('full');
  const visible = decodeCsesHtml(html.replace(/<[^>]*>/g, ' '));
  const status = visible.match(/(?:Submission\s+status|Verdict|Result)\s*:?\s*(Accepted|Wrong answer|Time limit exceeded|Memory limit exceeded|Runtime error|Compilation error|Pending|Testing|Failed|Skipped)/i)?.[1];
  return status ? status.toLowerCase() === 'accepted' : null;
}
