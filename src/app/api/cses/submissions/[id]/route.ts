import { NextRequest, NextResponse } from 'next/server';
import { csesRequest, CSES_BASE_URL, getSharedCsesSession } from '@/core/cses-network';
import { registerUserMapping } from '@/core/cses-user-cache';
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
    const submissions: CsesSubmissionSummary[] = [];
    const seenIds = new Set<string>();

    // 1. Fetch official CSES Queue (all users' live submissions)
    const queueUrl = `${CSES_BASE_URL}/problemset/queue/${problemId}/1/`;
    const queueRes = await csesRequest(queueUrl, { cookie: sessionCookie });

    if (queueRes.statusCode === 200) {
      const queueRowRegex =
        /<tr>\s*<td[^>]*>([\d\s:-]+)<\/td>\s*<td[^>]*>(?:<a[^>]*href="\/user\/(\d+)\/?"[^>]*>([^<]+)<\/a>|([^<]+))<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*class="[^"]*task-score[^"]*icon\s+([^"]+)"[^>]*><\/td>\s*<td[^>]*>(?:<a[^>]*href="[^"]*(?:entry|result)\/(\d+)\/?"[^>]*>.*?<\/a>)?<\/td>\s*<\/tr>/gi;

      let match: RegExpExecArray | null;
      while ((match = queueRowRegex.exec(queueRes.body)) !== null) {
        const time = match[1].trim();
        const userId = match[2]?.trim();
        const user = (match[3] || match[4] || 'Anonymous').trim();
        const language = match[5].trim();
        const runtime = match[6].replace(/&nbsp;/g, ' ').trim();
        const size = match[7].replace(/&nbsp;/g, ' ').trim();
        const rawStatus = match[8].trim();
        const submissionId = match[9]?.trim();

        if (userId && user) {
          registerUserMapping(user, userId);
        }

        const status = rawStatus.includes('full')
          ? 'ACCEPTED'
          : rawStatus.includes('zero')
          ? 'WRONG ANSWER'
          : rawStatus.toUpperCase();

        if (submissionId) {
          seenIds.add(submissionId);
        }

        submissions.push({
          id: submissionId || `queue-${submissions.length + 1}`,
          user,
          userId,
          time,
          language,
          runtime,
          size,
          status,
          resultUrl: submissionId
            ? `${CSES_BASE_URL}/problemset/hack/${problemId}/entry/${submissionId}/`
            : `${CSES_BASE_URL}/problemset/queue/${problemId}/1/`,
        });
      }
    }

    // 2. Also fetch personal results from view page if available
    const viewUrl = `${CSES_BASE_URL}/problemset/view/${problemId}/`;
    const viewRes = await csesRequest(viewUrl, { cookie: sessionCookie });

    if (viewRes.statusCode === 200) {
      const viewRowRegex =
        /<tr>\s*<td[^>]*>([\d\s:-]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*class="[^"]*task-score[^"]*icon\s+([^"]+)"[^>]*><\/td>\s*<td[^>]*><a[^>]*href="\/problemset\/result\/(\d+)\/?"[^>]*>.*?<\/a><\/td>\s*<\/tr>/gi;

      let vMatch: RegExpExecArray | null;
      while ((vMatch = viewRowRegex.exec(viewRes.body)) !== null) {
        const time = vMatch[1].trim();
        const language = vMatch[2].trim();
        const runtime = vMatch[3].replace(/&nbsp;/g, ' ').trim();
        const size = vMatch[4].replace(/&nbsp;/g, ' ').trim();
        const rawStatus = vMatch[5].trim();
        const submissionId = vMatch[6].trim();

        const status = rawStatus.includes('full')
          ? 'ACCEPTED'
          : rawStatus.includes('zero')
          ? 'WRONG ANSWER'
          : rawStatus.toUpperCase();

        if (!seenIds.has(submissionId)) {
          seenIds.add(submissionId);
          // Insert at the front so user's own submissions are prominent
          submissions.unshift({
            id: submissionId,
            user: 'csesbetter99',
            userId: '520654',
            time,
            language,
            runtime,
            size,
            status,
            resultUrl: `${CSES_BASE_URL}/problemset/result/${submissionId}/`,
          });
        }
      }
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
