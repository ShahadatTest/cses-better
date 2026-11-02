import { NextRequest, NextResponse } from 'next/server';
import { csesRequest, extractCsrfToken, CSES_BASE_URL } from '@/core/cses-network';
import { registerUserMapping } from '@/core/cses-user-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { nick, pass } = await request.json();

    if (!nick || !pass) {
      return NextResponse.json(
        { success: false, error: 'Nickname and password are required' },
        { status: 400 }
      );
    }

    // 1. Fetch login page to extract CSRF token and initial session cookie
    const loginPageRes = await csesRequest(`${CSES_BASE_URL}/login`);
    const csrfToken = extractCsrfToken(loginPageRes.body);

    if (!csrfToken) {
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve CSRF token from CSES login page' },
        { status: 502 }
      );
    }

    // 2. Submit credentials to CSES login endpoint
    const postBody = new URLSearchParams({
      csrf_token: csrfToken,
      nick: nick.trim(),
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

    // Check for login errors in response body
    const isError =
      authRes.body.includes('Invalid username or password') ||
      authRes.body.includes('class="error"') ||
      (authRes.statusCode === 200 && authRes.body.includes('action="/login"'));

    if (isError) {
      const errorMatch = authRes.body.match(/<p class="error">([^<]+)<\/p>/i);
      const errorMsg = errorMatch ? errorMatch[1] : 'Invalid CSES username or password.';
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 401 }
      );
    }

    // Login successful - extract numeric user ID from session
    const sessionCookie = authRes.cookies || loginPageRes.cookies;
    let userId: string | undefined;

    const directMatch = authRes.body.match(/<a class="account" href="\/user\/(\d+)">/i);
    if (directMatch) {
      userId = directMatch[1];
    } else {
      try {
        const homeRes = await csesRequest(`${CSES_BASE_URL}/`, { cookie: sessionCookie });
        const homeMatch = homeRes.body.match(/<a class="account" href="\/user\/(\d+)">/i);
        if (homeMatch) {
          userId = homeMatch[1];
        }
      } catch (e) {
        console.warn('[CSES Auth] Could not extract numeric user ID:', e);
      }
    }

    const cleanNick = nick.trim();
    if (userId) {
      registerUserMapping(cleanNick, userId);
    }

    const response = NextResponse.json({
      success: true,
      nick: cleanNick,
      userId,
      sessionCookie,
    });

    if (sessionCookie) {
      response.cookies.set('cses_session', sessionCookie, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 86400 * 30,
      });
    }

    return response;
  } catch (error: any) {
    console.error('[CSES Auth] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to authenticate with CSES' },
      { status: 500 }
    );
  }
}
