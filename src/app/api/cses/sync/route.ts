import { NextRequest, NextResponse } from 'next/server';
import {
  csesRequest,
  extractCsrfToken,
  CSES_BASE_URL,
  getSharedCsesSession,
} from '@/core/cses-network';
import { registerUserMapping, resolveUserNickToId } from '@/core/cses-user-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { nick, pass, sessionCookie: inputCookie } = await request.json();

    let sessionCookie = inputCookie;
    let cleanNick = (nick || '').trim();
    let userId: string | undefined;

    // 1. If password provided or no session cookie, authenticate with CSES
    if (cleanNick && pass) {
      const loginPageRes = await csesRequest(`${CSES_BASE_URL}/login`);
      const csrfToken = extractCsrfToken(loginPageRes.body);

      if (!csrfToken) {
        return NextResponse.json(
          { success: false, error: 'Failed to retrieve CSRF token from CSES login page' },
          { status: 502 }
        );
      }

      const postBody = new URLSearchParams({
        csrf_token: csrfToken,
        nick: cleanNick,
        pass,
      }).toString();

      const authRes = await csesRequest(`${CSES_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postBody).toString(),
        },
        body: postBody,
        cookie: loginPageRes.cookies,
      });

      const isError =
        authRes.body.includes('Invalid username or password') ||
        authRes.body.includes('class="error"') ||
        (authRes.statusCode === 200 && authRes.body.includes('action="/login"'));

      if (isError) {
        const errorMatch = authRes.body.match(/<p class="error">([^<]+)<\/p>/i);
        const errorMsg = errorMatch ? errorMatch[1] : 'Invalid CSES username or password.';
        return NextResponse.json({ success: false, error: errorMsg }, { status: 401 });
      }

      sessionCookie = authRes.cookies || loginPageRes.cookies;

      // Extract user ID
      const directMatch = authRes.body.match(/<a class="account" href="\/user\/(\d+)">/i);
      if (directMatch) {
        userId = directMatch[1];
      }
    }

    // Fallback user ID extraction
    if (!userId && cleanNick) {
      userId = resolveUserNickToId(cleanNick);
    }

    if (!userId && sessionCookie) {
      try {
        const homeRes = await csesRequest(`${CSES_BASE_URL}/`, { cookie: sessionCookie });
        const homeMatch = homeRes.body.match(/<a class="account" href="\/user\/(\d+)">([^<]+)<\/a>/i);
        if (homeMatch) {
          userId = homeMatch[1];
          if (!cleanNick) cleanNick = homeMatch[2].trim();
        }
      } catch (e) {
        console.warn('[CSES Sync] Home page check notice:', e);
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to resolve CSES User ID. Please provide valid CSES credentials.' },
        { status: 400 }
      );
    }

    registerUserMapping(cleanNick, userId);

    // 2. Fetch problemset page for user: https://cses.fi/problemset/user/<userId>/
    // Requires authenticated session cookie to return solved tasks
    const activeCookie = sessionCookie || (await getSharedCsesSession());
    const psRes = await csesRequest(`${CSES_BASE_URL}/problemset/user/${userId}/`, {
      cookie: activeCookie,
    });

    if (psRes.statusCode !== 200) {
      return NextResponse.json(
        { success: false, error: `Failed to load user problemset from CSES (Status ${psRes.statusCode})` },
        { status: 502 }
      );
    }

    const solvedProblems: { id: string; name: string }[] = [];
    const taskLinkRegex =
      /<a href="\/problemset\/task\/(\d+)\/?"\s+title="([^"]+)"\s+class="task-score icon full"/gi;
    let match: RegExpExecArray | null;

    while ((match = taskLinkRegex.exec(psRes.body)) !== null) {
      solvedProblems.push({
        id: match[1],
        name: match[2].trim(),
      });
    }

    const response = NextResponse.json({
      success: true,
      nick: cleanNick,
      userId,
      sessionCookie,
      solvedCount: solvedProblems.length,
      solvedProblemIds: solvedProblems.map((p) => p.id),
      solvedProblems,
      syncedAt: Date.now(),
    });

    return response;
  } catch (err: any) {
    console.error('[CSES Sync] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to sync CSES solved problems' },
      { status: 500 }
    );
  }
}
