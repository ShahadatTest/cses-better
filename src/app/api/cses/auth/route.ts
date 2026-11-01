import { NextRequest, NextResponse } from 'next/server';
import { csesRequest, extractCsrfToken, CSES_BASE_URL } from '@/core/cses-network';

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

    // Login successful
    return NextResponse.json({
      success: true,
      nick: nick.trim(),
      sessionCookie: authRes.cookies || loginPageRes.cookies,
    });
  } catch (error: any) {
    console.error('[CSES Auth] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to authenticate with CSES' },
      { status: 500 }
    );
  }
}
