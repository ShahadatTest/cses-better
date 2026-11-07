import { NextRequest, NextResponse } from 'next/server';
import {
  csesRequest,
  extractCsrfToken,
  mapLanguageToCsesOption,
  CSES_BASE_URL,
} from '@/core/cses-network';
import { registerUserMapping } from '@/core/cses-user-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function buildMultipartFormData(
  fields: Record<string, string>,
  file: { fieldName: string; filename: string; contentType: string; content: string }
) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const crlf = '\r\n';
  const chunks: Buffer[] = [];

  for (const [key, val] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}${crlf}Content-Disposition: form-data; name="${key}"${crlf}${crlf}${val}${crlf}`
      )
    );
  }

  chunks.push(
    Buffer.from(
      `--${boundary}${crlf}Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"${crlf}Content-Type: ${file.contentType}${crlf}${crlf}`
    )
  );
  chunks.push(Buffer.from(file.content, 'utf-8'));
  chunks.push(Buffer.from(`${crlf}--${boundary}--${crlf}`));

  return {
    boundary,
    body: Buffer.concat(chunks),
  };
}

function getFileExtension(language: string): string {
  switch (language.toLowerCase()) {
    case 'cpp':
    case 'c++':
      return 'cpp';
    case 'python':
    case 'py':
      return 'py';
    case 'java':
      return 'java';
    case 'rust':
    case 'rs':
      return 'rs';
    case 'go':
      return 'go';
    case 'c':
      return 'c';
    case 'javascript':
    case 'js':
      return 'js';
    case 'typescript':
    case 'ts':
      return 'ts';
    default:
      return 'cpp';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { nick, userId: expectedUserId, pass, sessionCookie: suppliedSessionCookie, problemId, language, code, useDefaultBot } = await request.json();

    if (!problemId || !code) {
      return NextResponse.json(
        { success: false, error: 'Problem ID and solution code are required' },
        { status: 400 }
      );
    }

    const personalNick = typeof nick === 'string' ? nick.trim() : '';
    const sessionCookie = !useDefaultBot && !pass && typeof suppliedSessionCookie === 'string'
      ? suppliedSessionCookie.trim() : '';
    if (sessionCookie && (!/^PHPSESSID=[A-Za-z0-9._~-]+(?:; [A-Za-z0-9_-]+=[A-Za-z0-9._~-]+)*$/.test(sessionCookie))) {
      return NextResponse.json({ success: false, error: 'Invalid remembered CSES session. Reconnect your CSES account.' }, { status: 400 });
    }
    const effectiveNick = useDefaultBot ? process.env.CSES_BOT_NICK?.trim() : personalNick;
    const effectivePass = useDefaultBot ? process.env.CSES_BOT_PASS : pass;

    if (!effectiveNick || (!sessionCookie && !effectivePass)) {
      return NextResponse.json(
        { success: false, error: useDefaultBot ? 'Shared CSES bot is not configured. Set CSES_BOT_NICK and CSES_BOT_PASS on the server, or submit with your own CSES account.' : 'CSES username and password are required, or reconnect with a valid remembered CSES session.' },
        { status: 400 }
      );
    }

    // 1. Use an explicitly selected personal session, or log in with the supplied account.
    let activeSessionCookie = sessionCookie;
    if (!activeSessionCookie) {
    const loginPageRes = await csesRequest(`${CSES_BASE_URL}/login`);
    const loginCsrf = extractCsrfToken(loginPageRes.body);

    if (!loginCsrf) {
      return NextResponse.json(
        { success: false, error: 'Failed to obtain CSES login security token' },
        { status: 502 }
      );
    }

    const loginBody = new URLSearchParams({
      csrf_token: loginCsrf,
      nick: effectiveNick,
      pass: effectivePass,
    }).toString();

    const authRes = await csesRequest(`${CSES_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginBody).toString(),
      },
      body: loginBody,
      cookie: loginPageRes.cookies,
    });

    if (
      authRes.body.includes('Invalid username or password') ||
      (authRes.statusCode === 200 && authRes.body.includes('action="/login"'))
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid CSES username or password' },
        { status: 401 }
      );
    }

    activeSessionCookie = authRes.cookies || loginPageRes.cookies;
    }

    // 2. Fetch the problem submit page to extract task-specific CSRF token
    const taskPageUrl = `${CSES_BASE_URL}/problemset/task/${problemId}/`;
    const taskPageRes = await csesRequest(taskPageUrl, {
      cookie: activeSessionCookie,
    });

    // Register user ID if visible in header
    const userMatch = taskPageRes.body.match(/<a class="account" href="\/user\/(\d+)">/i);
    const accountNick = taskPageRes.body.match(/<a class="account" href="\/user\/\d+">([^<]+)<\/a>/i)?.[1]?.trim();
    if (sessionCookie && (!userMatch || !accountNick)) {
      return NextResponse.json(
        { success: false, error: 'Your remembered CSES session has expired. Enter your CSES password to reconnect.' },
        { status: 401 }
      );
    }
    if (userMatch && accountNick && !useDefaultBot && accountNick.toLocaleLowerCase() !== personalNick.toLocaleLowerCase()) {
      return NextResponse.json({ success: false, error: 'The CSES session belongs to a different account. Reconnect with the matching nickname.' }, { status: 403 });
    }
    if (userMatch && expectedUserId && userMatch[1] !== expectedUserId) {
      return NextResponse.json({ success: false, error: 'The CSES session account did not match the saved account. Reconnect before submitting.' }, { status: 403 });
    }
    if (userMatch && nick) {
      registerUserMapping(nick.trim(), userMatch[1]);
    }

    let taskCsrf = extractCsrfToken(taskPageRes.body);

    // Fallback: If not found on task page, try the direct submit page
    if (!taskCsrf) {
      const submitPageRes = await csesRequest(`${CSES_BASE_URL}/problemset/submit/${problemId}/`, {
        cookie: activeSessionCookie,
      });
      taskCsrf = extractCsrfToken(submitPageRes.body);
    }

    if (!taskCsrf) {
      if (sessionCookie) {
        return NextResponse.json(
          { success: false, error: 'Your remembered CSES session has expired. Enter your CSES password to reconnect.' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Failed to extract submission CSRF token from CSES' },
        { status: 502 }
      );
    }

    // 3. Construct multipart payload
    const csesLang = mapLanguageToCsesOption(language);
    const ext = getFileExtension(language);
    const filename = `solution.${ext}`;

    const formFields: Record<string, string> = {
      csrf_token: taskCsrf,
      task: problemId,
      lang: csesLang,
      type: 'course',
      target: 'problemset',
    };

    if (csesLang === 'C++') {
      formFields['option'] = 'C++20';
    } else if (csesLang === 'Python3') {
      formFields['option'] = 'PyPy3';
    } else if (csesLang === 'Rust') {
      formFields['option'] = '2021';
    }

    const { boundary, body } = buildMultipartFormData(
      formFields,
      {
        fieldName: 'file',
        filename,
        contentType: 'text/plain',
        content: code,
      }
    );

    // 4. Submit to CSES official submission processor (/course/send.php)
    const submitUrl = `${CSES_BASE_URL}/course/send.php`;
    const submitRes = await csesRequest(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
      body,
      cookie: activeSessionCookie,
      followRedirects: false, // We want to inspect the 302 location!
    });

    // 5. Detect submission redirect
    const redirectUrl = submitRes.location || (submitRes.headers.location as string);
    let submissionId: string | undefined;

    if (redirectUrl) {
      const match = redirectUrl.match(/result\/(\d+)/);
      if (match) {
        submissionId = match[1];
      }
    }

    // If no redirect header, check body for link to result
    if (!submissionId) {
      const match = submitRes.body.match(/\/problemset\/result\/(\d+)/);
      if (match) {
        submissionId = match[1];
      }
    }

    if (!submissionId) {
      // Check for error in response body
      const errorMatch = submitRes.body.match(/<p class="error">([^<]+)<\/p>/i);
      const errMsg = errorMatch ? errorMatch[1] : 'Submission was not accepted by CSES.';
      return NextResponse.json(
        { success: false, error: errMsg },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      submissionId,
      resultUrl: `${CSES_BASE_URL}/problemset/result/${submissionId}/`,
      problemId,
      sessionCookie: activeSessionCookie,
      owner: { nick: effectiveNick, userId: userMatch?.[1], isPersonal: !useDefaultBot },
    });

    return response;
  } catch (err: any) {
    console.error('[CSES Submit] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Remote submission failed' },
      { status: 500 }
    );
  }
}
