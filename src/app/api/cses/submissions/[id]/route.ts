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
    const userSessionCookie =
      request.headers.get('x-cses-session') ||
      request.cookies.get('cses_session')?.value;

    const sessionCookie = userSessionCookie || (await getSharedCsesSession());
    const submissions: CsesSubmissionSummary[] = [];
    const mySubmissions: CsesSubmissionSummary[] = [];
    const seenIds = new Set<string>();

    // 1. Fetch personal results from view page first to identify personal submissions & account details
    const personalSubmissionsByTime = new Map<string, { id: string; user: string; userId: string; status: string }>();
    let personalUser = 'You';
    let personalUserId: string | undefined = undefined;

    const viewUrl = `${CSES_BASE_URL}/problemset/view/${problemId}/`;
    const viewRes = await csesRequest(viewUrl, { cookie: sessionCookie });

    if (viewRes.statusCode === 200) {
      const accountMatch = viewRes.body.match(/<a class="account" href="\/user\/(\d+)">([^<]+)<\/a>/i);
      if (accountMatch) {
        personalUserId = accountMatch[1].trim();
        personalUser = accountMatch[2].trim();
        registerUserMapping(personalUser, personalUserId);
      }

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

        const personalRecord: CsesSubmissionSummary = {
          id: submissionId,
          user: personalUser,
          userId: personalUserId,
          time,
          language,
          runtime,
          size,
          status,
          resultUrl: `${CSES_BASE_URL}/problemset/result/${submissionId}/`,
        };

        personalSubmissionsByTime.set(time, {
          id: submissionId,
          user: personalUser,
          userId: personalUserId || '520654',
          status,
        });

        mySubmissions.push(personalRecord);

        if (!seenIds.has(submissionId)) {
          seenIds.add(submissionId);
          submissions.push(personalRecord);
        }
      }

      // Also parse sidebar "Your submissions" list to ensure no historical submissions are missed
      const sidebarRegex =
        /<a[^>]*href="\/problemset\/result\/(\d+)\/?"[^>]*>([\d\s:-]+)\s*<span[^>]*class="[^"]*task-score[^"]*icon\s+([^"]+)"[^>]*><\/span><\/a>/gi;
      let sMatch: RegExpExecArray | null;
      while ((sMatch = sidebarRegex.exec(viewRes.body)) !== null) {
        const submissionId = sMatch[1].trim();
        const time = sMatch[2].trim();
        const rawStatus = sMatch[3].trim();

        if (!seenIds.has(submissionId)) {
          seenIds.add(submissionId);
          const status = rawStatus.includes('full')
            ? 'ACCEPTED'
            : rawStatus.includes('zero')
            ? 'WRONG ANSWER'
            : rawStatus.toUpperCase();

          const rec: CsesSubmissionSummary = {
            id: submissionId,
            user: personalUser,
            userId: personalUserId,
            time,
            language: 'C++',
            runtime: '--',
            size: '--',
            status,
            resultUrl: `${CSES_BASE_URL}/problemset/result/${submissionId}/`,
          };
          mySubmissions.push(rec);
          submissions.push(rec);
        }
      }
    }

    // 2. Fetch official CSES Queue (all users' live submissions)
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
        let submissionId = match[9]?.trim();

        if (userId && user) {
          registerUserMapping(user, userId);
        }

        const status = rawStatus.includes('full')
          ? 'ACCEPTED'
          : rawStatus.includes('zero')
          ? 'WRONG ANSWER'
          : rawStatus.toUpperCase();

        // Correlate with personal submissions if this queue item is from the current user
        if (!submissionId && personalSubmissionsByTime.has(time)) {
          submissionId = personalSubmissionsByTime.get(time)!.id;
        }

        if (submissionId) {
          if (seenIds.has(submissionId)) {
            // Already added from view page, skip duplicate
            continue;
          }
          seenIds.add(submissionId);
        }

        submissions.push({
          id: submissionId || `wa-${userId || 'anon'}-${time.replace(/[^\d]/g, '')}`,
          user: user === personalUser && personalUser !== 'You' ? personalUser : user,
          userId: userId || (user === personalUser ? personalUserId : undefined),
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

    const isLocked = queueRes.statusCode === 404 && viewRes.statusCode === 404 && submissions.length === 0;

    return NextResponse.json({
      problemId,
      count: submissions.length,
      submissions,
      mySubmissions,
      currentUser: personalUser !== 'You' ? { nick: personalUser, userId: personalUserId } : undefined,
      isLocked,
      message: isLocked
        ? "CSES locks the submission queue until this problem is solved. Solve and submit this problem on CSES (or connect a CSES account that solved it) to unlock live submissions."
        : undefined,
    });
  } catch (err: any) {
    console.error(`[CSES Submissions ${problemId}] Error:`, err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch CSES submissions for problem' },
      { status: 500 }
    );
  }
}
