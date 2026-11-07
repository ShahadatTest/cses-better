import { NextRequest, NextResponse } from 'next/server';
import { csesRequest, CSES_BASE_URL, getSharedCsesSession } from '@/core/cses-network';
import { registerUserMapping } from '@/core/cses-user-cache';
import { CsesSubmissionSummary } from '@/core/types';
import { normalizeCsesLanguage, nextQueuePageLink, parseQueueRows } from '@/core/cses-history';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const problemId = params.id;
  if (!/^\d{1,10}$/.test(problemId || '')) return NextResponse.json({ error: 'Valid numeric Problem ID is required' }, { status: 400 });
  const headers = { 'Cache-Control': 'private, no-store' };
  const requestedCursor = request.nextUrl.searchParams.get('cursor');
  const cursorUrl = requestedCursor ? (() => { try { const parsed = new URL(requestedCursor); const page = parsed.pathname.match(new RegExp(`^/problemset/queue/${problemId}/(\\d+)/?$`))?.[1]; return parsed.origin === CSES_BASE_URL && !parsed.username && !parsed.password && Number(page) <= 20000 ? parsed.toString() : ''; } catch { return ''; } })() : '';
  if (requestedCursor && !cursorUrl) return NextResponse.json({ error: 'Invalid history cursor' }, { status: 400, headers });
  try {
    const userCookie = request.headers.get('x-cses-session') || request.cookies.get('cses_session')?.value;
    const cookie = userCookie || await getSharedCsesSession();
    const viewRes = userCookie ? await csesRequest(`${CSES_BASE_URL}/problemset/view/${problemId}/`, { cookie, timeout: 1500 }) : { statusCode: 0, body: '' };
    const submissions: CsesSubmissionSummary[] = [];
    const mySubmissions: CsesSubmissionSummary[] = [];
    let nick = 'You';
    let userId: string | undefined;
    const seen = new Set<string>();
    const account = viewRes.body.match(/<a class="account" href="\/user\/(\d+)">([^<]+)<\/a>/i);
    if (account) { userId = account[1]; nick = account[2].trim(); registerUserMapping(nick, userId); }
    const rowRe = /<tr>\s*<td[^>]*>([\d\s:-]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*class="[^"]*task-score[^\"]*icon\s+([^\"]+)"[^>]*><\/td>\s*<td[^>]*><a[^>]*href="\/problemset\/result\/(\d+)\/?"[^>]*>.*?<\/a><\/td>/gi;
    for (const m of viewRes.body.matchAll(rowRe)) {
      const status = m[5].includes('full') ? 'ACCEPTED' : m[5].includes('zero') ? 'FAILED' : m[5].toUpperCase();
      const id = m[6];
      const entry: CsesSubmissionSummary = { id, user: nick, userId, time: m[1].trim(), language: m[2].trim(), runtime: m[3].replace(/&nbsp;/g, ' ').trim(), size: m[4].replace(/&nbsp;/g, ' ').trim(), status, resultUrl: `${CSES_BASE_URL}/problemset/result/${id}/`, isPersonal: true };
      mySubmissions.push(entry); submissions.push(entry); seen.add(id);
    }

    let queueAvailable = false;
    let queueLocked = false;
    const langId: Record<string, string> = { 'all': '0', 'assembly': '1', 'c': '2', 'c++': '3', 'haskell': '4', 'java': '5', 'node.js': '6', 'pascal': '7', 'python': '8', 'ruby': '9', 'rust': '10', 'scala': '11' };
    const lang = request.nextUrl.searchParams.get('language')?.toLowerCase() || 'all';
    const officialLang = langId[lang] || (lang.includes('c++') || lang.includes('cpp') ? '3' : lang.includes('python') || lang.includes('pypy') ? '8' : lang.includes('javascript') || lang.includes('node') ? '6' : '0');
    const verdict = request.nextUrl.searchParams.get('verdict')?.toUpperCase() || 'ALL';
    const sort = request.nextUrl.searchParams.get('sort') || 'time_desc';
    if (!['time_desc', 'time_asc', 'runtime_asc', 'size_asc'].includes(sort) || !['all', 'accepted', 'pending', 'skipped', 'failed', 'wrong answer'].includes(verdict.toLowerCase()) || lang.length > 40) return NextResponse.json({ error: 'Invalid queue filter' }, { status: 400, headers });
    const formQuery = new URLSearchParams({ lang: officialLang, status: verdict === 'ACCEPTED' ? '2' : verdict === 'PENDING' ? '1' : verdict === 'SKIPPED' ? '4' : verdict === 'FAILED' || verdict === 'WRONG ANSWER' ? '3' : '0', by: sort === 'runtime_asc' ? '1' : sort === 'size_asc' ? '2' : '0', order: sort.endsWith('_asc') ? '0' : '1' });
    const filterUser = request.nextUrl.searchParams.get('user')?.trim().slice(0, 100);
    if (filterUser) formQuery.set('user', filterUser);
    const firstQueueUrl = `${CSES_BASE_URL}/problemset/queue/${problemId}/1?${formQuery}`;
    if (cursorUrl) { const next = new URL(cursorUrl); next.search = formQuery.toString(); next.hash = ''; }
    const pending = [cursorUrl ? (() => { const next = new URL(cursorUrl); next.search = formQuery.toString(); next.hash = ''; return next.toString(); })() : firstQueueUrl];
    const visited = new Set<string>();
    const bestOnly = verdict === 'ACCEPTED' && sort === 'runtime_asc' && Boolean(filterUser);
    while (pending.length && visited.size < (bestOnly ? 1 : 3)) {
      const url = pending.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      const res = await csesRequest(url, { cookie, timeout: 1500 });
      if (res.statusCode === 404) queueLocked = true;
      if (res.statusCode !== 200 || /<form[^>]+action="\/login"|name="nick"[^>]+name="pass"/i.test(res.body)) continue;
      queueAvailable = true;
      for (const item of parseQueueRows(res.body, problemId)) {
        if (item.userId) registerUserMapping(item.user, item.userId);
        const personal = mySubmissions.find(s => item.userId && item.userId === userId && s.time === item.time && s.language === item.language);
        const id = item.id || personal?.id;
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        submissions.push({ ...item, id: id || `unlinked-${item.time.replace(/\D/g, '')}`, userId: item.userId, resultUrl: id ? item.resultUrl : url });
      }
      const link = nextQueuePageLink(res.body, url, problemId);
      if (link) {
        const next = new URL(link);
        next.search = formQuery.toString();
        if (!visited.has(next.toString()) && !pending.includes(next.toString())) pending.push(next.toString());
      }
    }
    const filterLang = lang;
    const filterVerdict = verdict;
    const normalizedUser = filterUser?.toLowerCase();
    let filtered = submissions.filter(s => (!filterLang || filterLang === 'all' || normalizeCsesLanguage(s.language) === normalizeCsesLanguage(filterLang)) && (!filterVerdict || filterVerdict === 'ALL' || s.status.toUpperCase() === filterVerdict) && (!normalizedUser || s.user?.toLowerCase().includes(normalizedUser) || s.userId?.toLowerCase() === normalizedUser));
    if (sort === 'time_asc') filtered.sort((a, b) => a.time.localeCompare(b.time));
    else if (sort === 'time_desc') filtered.sort((a, b) => b.time.localeCompare(a.time));
    else if (sort === 'runtime_asc') filtered.sort((a, b) => parseFloat(a.runtime?.replace(/[^\d.]/g, '') || '999') - parseFloat(b.runtime?.replace(/[^\d.]/g, '') || '999'));
    else if (sort === 'size_asc') filtered.sort((a, b) => parseInt(a.size?.replace(/\D/g, '') || '999999', 10) - parseInt(b.size?.replace(/\D/g, '') || '999999', 10));
    const isLocked = queueLocked && (viewRes.statusCode === 404 || viewRes.statusCode === 0) && submissions.length === 0;
    return NextResponse.json({ problemId, count: filtered.length, submissions: filtered, mySubmissions, currentUser: userId ? { nick, userId } : undefined, isLocked, message: isLocked ? 'CSES locks the submissions queue until an accepted solution exists for this problem.' : undefined, historicalCoverage: queueAvailable ? (pending.length ? 'partial' : 'available') : 'unavailable', historyCursor: pending[0] || null }, { headers });
  } catch (err: any) {
    console.error(`[CSES Submissions ${problemId}] Error:`, err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch CSES submissions for problem' }, { status: 500, headers });
  }
}
