import { NextRequest, NextResponse } from 'next/server';
import { csesRequest, CSES_BASE_URL } from '@/core/cses-network';
import { CsesHistoryEntry, CsesHistoryResponse, parseOfficialAcceptedStatus, parseSubmissionTimestamp } from '@/core/cses-history';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const cookie = request.headers.get('x-cses-session') || request.cookies.get('cses_session')?.value;
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!cookie) return NextResponse.json({ error: 'Connected CSES session required' }, { status: 401, headers });
  const limit = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 10));
  const cursor = request.nextUrl.searchParams.get('cursor') || '';
  try {
    const index = await csesRequest(`${CSES_BASE_URL}/problemset/`, { cookie, timeout: 1500 });
    if (index.statusCode !== 200 || /<form[^>]+action="\/login"|name="nick"[^>]+name="pass"/i.test(index.body)) return NextResponse.json({ error: 'CSES session is not authenticated' }, { status: 401, headers });
    const uid = index.body.match(/href="\/user\/(\d+)\/?"[^>]*class="account"|class="account"[^>]*href="\/user\/(\d+)\/?"/i);
    const csesUserId = uid?.[1] || uid?.[2];
    if (!csesUserId) return NextResponse.json({ error: 'Could not verify connected CSES account' }, { status: 401, headers });
    const tasks = [...index.body.matchAll(/href="\/problemset\/task\/(\d+)\/?"/gi)].map(m => m[1]);
    const uniqueTasks = [...new Set(tasks)];
    const cursorMatch = cursor.match(/^(\d+)(?::(\d+))?$/);
    const start = cursor ? uniqueTasks.indexOf(cursorMatch?.[1] || '') : 0;
    if (cursor && (!cursorMatch || start < 0 || Number(cursorMatch[2] || 0) > 10000)) return NextResponse.json({ error: 'Invalid history cursor' }, { status: 400, headers });
    let submissionOffset = Number(cursorMatch?.[2] || 0);
    const entries: CsesHistoryEntry[] = [];
    let i = start;
    let omittedCount = 0;
    let processed = 0;
    let visitedTasks = 0;
    let requestCount = 1;
    for (; i < uniqueTasks.length && processed < limit && visitedTasks < 20 && requestCount < 6;) {
      const problemId = uniqueTasks[i];
      const page = await csesRequest(`${CSES_BASE_URL}/problemset/view/${problemId}/`, { cookie, timeout: 1500 });
      requestCount++;
      visitedTasks++;
      if (page.statusCode !== 200 || /<form[^>]+action="\/login"|name="nick"[^>]+name="pass"/i.test(page.body)) { omittedCount++; i++; submissionOffset = 0; continue; }
      const acceptedIds: string[] = [];
      for (const row of page.body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const id = row[1].match(/href="\/problemset\/result\/(\d+)\/?"/i)?.[1];
        const score = row[1].match(/class="[^"]*task-score[^\"]*icon\s+([^\"]+)"/i)?.[1];
        if (!id || !score?.includes('full')) continue;
        acceptedIds.push(id);
      }
      let j = submissionOffset;
      for (; j < acceptedIds.length && processed < limit && requestCount < 6; j++, processed++) {
        const submissionId = acceptedIds[j];
        const result = await csesRequest(`${CSES_BASE_URL}/problemset/result/${submissionId}/`, { cookie, timeout: 1500 });
        requestCount++;
        // The task page's score is useful for locating candidate accepts, but the
        // result page must independently confirm the accepted verdict before its
        // timestamp is counted as a personal solve.
        if (result.statusCode !== 200 || /<form[^>]+action="\/login"|name="nick"[^>]+name="pass"/i.test(result.body) || parseOfficialAcceptedStatus(result.body) !== true) { omittedCount++; continue; }
        const timestamp = parseSubmissionTimestamp(result.body);
        if (!timestamp) { omittedCount++; continue; }
        entries.push({ problemId, submissionId, csesUserId, ...timestamp });
      }
      if (j < acceptedIds.length) { submissionOffset = j; break; }
      i++; submissionOffset = 0;
    }
    const nextCursor = i < uniqueTasks.length ? `${uniqueTasks[i]}:${submissionOffset}` : null;
    const response: CsesHistoryResponse & { csesUserId: string; total: number; processed: number; incompleteReason?: string } = {
      entries: entries.sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt)), csesUserId, total: uniqueTasks.length, processed: Math.min(i + (i < uniqueTasks.length ? 1 : 0), uniqueTasks.length), nextCursor,
      complete: nextCursor === null && omittedCount === 0,
      omittedCount,
      ...(!nextCursor && !omittedCount ? {} : { incompleteReason: [nextCursor ? 'History continues from the next task/submission cursor.' : '', omittedCount ? `${omittedCount} task or accepted result pages lacked readable verified status/timestamps and were omitted.` : ''].filter(Boolean).join(' ') }),
    };
    return NextResponse.json(response, { headers });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to read CSES submission history' }, { status: 502, headers });
  }
}
