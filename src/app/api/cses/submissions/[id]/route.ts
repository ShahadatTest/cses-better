import { NextRequest, NextResponse } from 'next/server';
import { csesRequest, CSES_BASE_URL, getSharedCsesSession } from '@/core/cses-network';
import { CsesSubmissionSummary } from '@/core/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const problemId = params.id;
  if (!problemId || !/^\d+$/.test(problemId)) {
    return NextResponse.json({ error: 'Valid numeric Problem ID is required' }, { status: 400 });
  }

  try {
    const sessionCookie = await getSharedCsesSession();
    const url = `${CSES_BASE_URL}/problemset/view/${problemId}/`;
    const res = await csesRequest(url, { cookie: sessionCookie });

    if (res.statusCode === 404) {
      return NextResponse.json({ problemId, submissions: [] });
    }

    const html = res.body;
    const submissions: CsesSubmissionSummary[] = [];

    // Parse submissions table rows
    // e.g.: <tr><td>2026-11-02 05:33:03</td><td>C++</td><td>0.00 s</td><td>152 ch.</td><td class="task-score icon full"></td><td><a class="details-link" href="/problemset/result/19253839/">details</a></td></tr>
    const rowRegex =
      /<tr>\s*<td[^>]*>([\d\s:-]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*class="[^"]*task-score[^"]*icon\s+([^"]+)"[^>]*><\/td>\s*<td[^>]*><a[^>]*href="\/problemset\/result\/(\d+)\/?"[^>]*>.*?<\/a><\/td>\s*<\/tr>/gi;

    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(html)) !== null) {
      const time = match[1].trim();
      const language = match[2].trim();
      const runtime = match[3].trim();
      const size = match[4].trim();
      const rawStatus = match[5].trim();
      const submissionId = match[6].trim();

      const status = rawStatus.includes('full')
        ? 'ACCEPTED'
        : rawStatus.includes('zero')
        ? 'WRONG ANSWER'
        : rawStatus.toUpperCase();

      submissions.push({
        id: submissionId,
        time,
        language,
        runtime,
        size,
        status,
        resultUrl: `${CSES_BASE_URL}/problemset/result/${submissionId}/`,
      });
    }

    return NextResponse.json({
      problemId,
      count: submissions.length,
      submissions,
    });
  } catch (err: any) {
    console.error(`[CSES Submissions ${problemId}] Error:`, err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch CSES submissions for problem' },
      { status: 500 }
    );
  }
}
