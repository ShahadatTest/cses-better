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
    const { nick, pass, problemId, language, code } = await request.json();

    if (!problemId || !code) {
      return NextResponse.json(
        { success: false, error: 'Problem ID and solution code are required' },
        { status: 400 }
      );
    }

    if (!nick || !pass) {
      return NextResponse.json(
        { success: false, error: 'CSES username and password are required for official submission' },
        { status: 400 }
      );
    }

    // 1. Authenticate with CSES to obtain valid session cookie
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
      nick: nick.trim(),
      pass,
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

    const sessionCookie = authRes.cookies || loginPageRes.cookies;

    // 2. Fetch the problem submit page to extract task-specific CSRF token
    const taskPageUrl = `${CSES_BASE_URL}/problemset/task/${problemId}/`;
    const taskPageRes = await csesRequest(taskPageUrl, {
      cookie: sessionCookie,
    });

    // Register user ID if visible in header
    const userMatch = taskPageRes.body.match(/<a class="account" href="\/user\/(\d+)">/i);
    if (userMatch && nick) {
      registerUserMapping(nick.trim(), userMatch[1]);
    }

    let taskCsrf = extractCsrfToken(taskPageRes.body);

    // Fallback: If not found on task page, try the direct submit page
    if (!taskCsrf) {
      const submitPageRes = await csesRequest(`${CSES_BASE_URL}/problemset/submit/${problemId}/`, {
        cookie: sessionCookie,
      });
      taskCsrf = extractCsrfToken(submitPageRes.body);
    }

    if (!taskCsrf) {
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
      cookie: sessionCookie,
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

    return NextResponse.json({
      success: true,
      submissionId,
      resultUrl: `${CSES_BASE_URL}/problemset/result/${submissionId}/`,
      problemId,
    });
  } catch (err: any) {
    console.error('[CSES Submit] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Remote submission failed' },
      { status: 500 }
    );
  }
}
