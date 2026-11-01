import { NextRequest, NextResponse } from 'next/server';
import { csesRequest, CSES_BASE_URL, getSharedCsesSession } from '@/core/cses-network';
import { CsesUserProfile } from '@/core/types';
import {
  resolveUserNickToId,
  registerUserMapping,
  ingestTopUsersFromCses,
} from '@/core/cses-user-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { nick: string } }
) {
  const inputParam = decodeURIComponent(params.nick || '').trim();
  if (!inputParam) {
    return NextResponse.json({ error: 'Username or CSES User ID is required' }, { status: 400 });
  }

  try {
    const sessionCookie = await getSharedCsesSession();

    // 1. Resolve numeric CSES user ID
    let targetUserId = resolveUserNickToId(inputParam);

    // If nickname not in cache, attempt on-demand sync from global problemset stats
    if (!targetUserId && !/^\d+$/.test(inputParam)) {
      await ingestTopUsersFromCses(sessionCookie);
      targetUserId = resolveUserNickToId(inputParam);
    }

    if (!targetUserId) {
      return NextResponse.json(
        {
          error: `CSES profile URLs use numeric IDs (e.g. /user/134297). Nickname '${inputParam}' is not yet indexed. Please search by their numeric CSES User ID or click a user on the leaderboard.`,
          isNumericRequired: true,
        },
        { status: 404 }
      );
    }

    // 2. Fetch both CSES profile endpoints concurrently
    const userUrl = `${CSES_BASE_URL}/user/${targetUserId}/`;
    const problemsetUrl = `${CSES_BASE_URL}/problemset/user/${targetUserId}/`;

    const [userRes, problemsetRes] = await Promise.all([
      csesRequest(userUrl, { cookie: sessionCookie }),
      csesRequest(problemsetUrl, { cookie: sessionCookie }),
    ]);

    if (
      userRes.statusCode === 404 ||
      userRes.body.includes('User not found') ||
      userRes.body.includes('Invalid user')
    ) {
      return NextResponse.json(
        { error: `CSES User #${targetUserId} not found on CSES.fi` },
        { status: 404 }
      );
    }

    const userHtml = userRes.body;
    const psHtml = problemsetRes.body;

    // 3. Extract Nickname
    let resolvedNick = inputParam;
    const h1Match = userHtml.match(/<h1>User ([^<]+)<\/h1>/i);
    const h2Match = psHtml.match(/<h2>Statistics for ([^<]+)<\/h2>/i);
    if (h1Match) {
      resolvedNick = h1Match[1].trim();
    } else if (h2Match) {
      resolvedNick = h2Match[1].trim();
    }

    // Cache the resolved mapping
    if (resolvedNick && targetUserId) {
      registerUserMapping(resolvedNick, targetUserId);
    }

    // 4. Parse Real / Display Name (if present)
    let name: string | undefined;
    const nameMatch = userHtml.match(/<h2>([^<]+)<\/h2>/i);
    if (nameMatch && !nameMatch[1].includes('User information') && !nameMatch[1].includes('Languages')) {
      name = nameMatch[1].trim();
    }

    // 5. Parse Country
    let country: string | undefined;
    const countryMatch = userHtml.match(/Country:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
    if (countryMatch) {
      country = countryMatch[1].trim();
    }

    // 6. Parse Registered date
    let registeredDate: string | undefined;
    const regMatch = userHtml.match(/Registered:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
    if (regMatch) {
      registeredDate = regMatch[1].trim();
    }

    // 7. Parse Submission Counts and Dates
    let submissionCount: number | undefined;
    const subMatch = userHtml.match(/Submission count:<\/td>\s*<td[^>]*>([\d,]+)<\/td>/i);
    if (subMatch) {
      submissionCount = parseInt(subMatch[1].replace(/,/g, ''), 10);
    }

    let firstSubmission: string | undefined;
    const firstMatch = userHtml.match(/First submission:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
    if (firstMatch) {
      firstSubmission = firstMatch[1].trim();
    }

    let lastSubmission: string | undefined;
    const lastMatch = userHtml.match(/Last submission:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
    if (lastMatch) {
      lastSubmission = lastMatch[1].trim();
    }

    // 8. Parse Languages Breakdown
    const languages: { language: string; submissions: number; share: string }[] = [];
    const langRows = [
      ...userHtml.matchAll(
        /<tr>\s*<td\s*>([^<]+)<\/td>\s*<td\s*>([\d,]+)<\/td>\s*<td\s*>([^<]+)<\/td>\s*<\/tr>/gi
      ),
    ];
    for (const r of langRows) {
      const lang = r[1].trim();
      if (lang.toLowerCase() !== 'language') {
        languages.push({
          language: lang,
          submissions: parseInt(r[2].replace(/,/g, ''), 10),
          share: r[3].trim(),
        });
      }
    }

    // 9. Parse Solved Problems from Problemset Page
    const solvedProblems: { id: string; name: string }[] = [];
    const taskLinkRegex =
      /<a href="\/problemset\/task\/(\d+)\/?"\s+title="([^"]+)"\s+class="task-score icon full"/gi;
    let taskMatch: RegExpExecArray | null;

    while ((taskMatch = taskLinkRegex.exec(psHtml)) !== null) {
      solvedProblems.push({
        id: taskMatch[1],
        name: taskMatch[2].trim(),
      });
    }

    // Solved count check
    let solvedCount = solvedProblems.length;
    const solvedTasksMatch = psHtml.match(/Solved tasks:\s*(\d+)\/(\d+)/i);
    if (solvedTasksMatch) {
      solvedCount = parseInt(solvedTasksMatch[1], 10);
    }

    const userProfile: CsesUserProfile = {
      nick: resolvedNick,
      userId: targetUserId,
      name,
      country,
      registeredDate,
      submissionCount,
      firstSubmission,
      lastSubmission,
      languages,
      solvedCount,
      solvedProblems,
      officialUrl: `${CSES_BASE_URL}/user/${targetUserId}/`,
    };

    return NextResponse.json(userProfile);
  } catch (error: any) {
    console.error(`[CSES User Profile ${inputParam}] Error:`, error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch user profile from CSES' },
      { status: 500 }
    );
  }
}
