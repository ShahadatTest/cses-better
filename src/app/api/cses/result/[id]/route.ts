import { NextRequest, NextResponse } from 'next/server';
import { csesRequest, CSES_BASE_URL, getSharedCsesSession } from '@/core/cses-network';
import { parseCsesResult, trustedCsesDetailUrl } from '@/core/cses-result-parser';
import { CsesVerdictResult } from '@/core/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const privateHeaders = { 'Cache-Control': 'private, no-store' };
const inaccessible = (html: string) => /<form\b[^>]*action=["'][^"']*\/login|<title[^>]*>\s*login\b|name=["']pass["']|submission not found|access denied|not allowed to view|not permitted to view|private submission|you need to log in/i.test(html);

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const submissionId = params.id;
  if (!/^\d+$/.test(submissionId)) return NextResponse.json({ error: 'Valid numeric submission ID is required' }, { status: 400, headers: privateHeaders });
  const problemId = request.nextUrl.searchParams.get('problemId') || '';
  if (problemId && !/^[a-z\d_-]{1,80}$/i.test(problemId)) return NextResponse.json({ error: 'Invalid problem ID' }, { status: 400, headers: privateHeaders });

  try {
    const personalCookie = request.headers.get('x-cses-session') || request.cookies.get('cses_session')?.value;
    const cookie = personalCookie || await getSharedCsesSession();
    let url = `${CSES_BASE_URL}/problemset/result/${submissionId}/`;
    let response = await csesRequest(url, { cookie });
    let html = response.statusCode === 200 ? response.body : '';

    // CSES serves login and private-result pages with HTTP 200.
    if (inaccessible(html)) html = '';
    if (!html && problemId) {
      url = `${CSES_BASE_URL}/problemset/hack/${problemId}/entry/${submissionId}/`;
      response = await csesRequest(url, { cookie });
      const candidate = response.statusCode === 200 ? response.body : '';
      if (!inaccessible(candidate) && /<pre\b/i.test(candidate)) html = candidate;
    }
    if (!html) return NextResponse.json({ error: 'CSES submission is unavailable or private. Connect the submitting account to inspect it.' }, { status: 404, headers: privateHeaders });

    const parsed = parseCsesResult(html);
    const result: CsesVerdictResult = {
      submissionId, ...parsed,
      tests: parsed.tests.map((test) => ({ ...test, detailsUrl: trustedCsesDetailUrl(test.detailsUrl, CSES_BASE_URL) })),
      resultUrl: url, problemId: problemId || undefined,
      source: 'cses',
    };
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error: any) {
    console.error(`[CSES Result ${submissionId}] Error:`, error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch CSES submission result' }, { status: 500, headers: privateHeaders });
  }
}
