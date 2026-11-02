import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory sliding window rate limiter: 120 requests per 60 seconds per IP (supports parallel test suites)
const ipRateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 120;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipRateLimit.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    ipRateLimit.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  ipRateLimit.set(ip, timestamps);
  return false;
}

interface LanguageDefinition {
  pistonLanguage: string;
  defaultVersion: string;
  extension: string;
}

const LANGUAGE_DEFINITIONS: Record<string, LanguageDefinition> = {
  cpp: { pistonLanguage: 'c++', defaultVersion: '15', extension: '.cpp' },
  'c++': { pistonLanguage: 'c++', defaultVersion: '15', extension: '.cpp' },
  'g++': { pistonLanguage: 'c++', defaultVersion: '15', extension: '.cpp' },
  c: { pistonLanguage: 'c', defaultVersion: '15', extension: '.c' },
  gcc: { pistonLanguage: 'c', defaultVersion: '15', extension: '.c' },
  python: { pistonLanguage: 'python', defaultVersion: '3.14', extension: '.py' },
  python3: { pistonLanguage: 'python', defaultVersion: '3.14', extension: '.py' },
  py: { pistonLanguage: 'python', defaultVersion: '3.14', extension: '.py' },
  java: { pistonLanguage: 'java', defaultVersion: '25', extension: '.java' },
  rust: { pistonLanguage: 'rust', defaultVersion: '1.93', extension: '.rs' },
  rs: { pistonLanguage: 'rust', defaultVersion: '1.93', extension: '.rs' },
  go: { pistonLanguage: 'go', defaultVersion: '1.26', extension: '.go' },
  golang: { pistonLanguage: 'go', defaultVersion: '1.26', extension: '.go' },
  javascript: { pistonLanguage: 'javascript', defaultVersion: '24', extension: '.js' },
  js: { pistonLanguage: 'javascript', defaultVersion: '24', extension: '.js' },
  node: { pistonLanguage: 'javascript', defaultVersion: '24', extension: '.js' },
  typescript: { pistonLanguage: 'typescript', defaultVersion: '2', extension: '.ts' },
  ts: { pistonLanguage: 'typescript', defaultVersion: '2', extension: '.ts' },
};

const DEFAULT_API_KEY = 'b4b490a8bb89d44e4f65b2d857570af2';

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.ip ||
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      'anonymous';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a minute before compiling again.' },
        { status: 429 }
      );
    }

    const payload = await request.json();

    // Payload validation
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const rawLanguage = payload.language;
    if (!rawLanguage || typeof rawLanguage !== 'string') {
      return NextResponse.json({ error: 'Valid language string is required' }, { status: 400 });
    }

    const langKey = rawLanguage.toLowerCase().trim();
    const langDef = LANGUAGE_DEFINITIONS[langKey];
    const targetLanguage = langDef ? langDef.pistonLanguage : rawLanguage;
    const targetVersion = payload.version || langDef?.defaultVersion || '*';

    // Support both standard Piston payload format (files array) and simplified format (code string)
    let files = payload.files;
    if (!Array.isArray(files) || files.length === 0) {
      const codeContent = typeof payload.code === 'string' ? payload.code : '';
      const ext = langDef ? langDef.extension : '.txt';
      const fileName = (langKey === 'java' || ext === '.java') ? 'Main.java' : `solution${ext}`;
      files = [{ name: fileName, content: codeContent }];
    }

    // Code length check (max 64KB)
    const codeContent = files[0]?.content || payload.code || '';
    if (codeContent.length > 64 * 1024) {
      return NextResponse.json({ error: 'Code size exceeds maximum limit of 64KB' }, { status: 413 });
    }

    // Stdin length check (max 150KB)
    if (payload.stdin && payload.stdin.length > 150 * 1024) {
      return NextResponse.json({ error: 'Stdin size exceeds maximum limit of 150KB' }, { status: 413 });
    }

    const clientAuth = request.headers.get('authorization') || request.headers.get('x-api-key') || payload.apiKey;
    const apiKey = process.env.COMPILER_API_KEY || clientAuth || DEFAULT_API_KEY;
    const baseUrl = process.env.COMPILER_BASE_URL || 'https://api.onlinecompiler.io/api/v2/piston';
    const fallbackBaseUrl = process.env.COMPILER_FALLBACK_URL;

    const pistonPayload: Record<string, any> = {
      language: targetLanguage,
      version: targetVersion,
      files,
      stdin: payload.stdin ?? '',
    };
    if (payload.args && Array.isArray(payload.args)) {
      pistonPayload.args = payload.args;
    }
    if (payload.compile_args && Array.isArray(payload.compile_args)) {
      pistonPayload.compile_args = payload.compile_args;
    }

    async function callCompilerEndpoint(url: string, key: string) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': key,
      };
      return fetch(`${url}/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify(pistonPayload),
      });
    }

    let response = await callCompilerEndpoint(baseUrl, apiKey);

    // If client provided a custom key that returned 403, retry with DEFAULT_API_KEY
    if (response.status === 403 && apiKey !== DEFAULT_API_KEY) {
      try {
        const retryRes = await callCompilerEndpoint(baseUrl, DEFAULT_API_KEY);
        if (retryRes.ok || retryRes.status !== 403) {
          response = retryRes;
        }
      } catch {
        // Fallback to initial response
      }
    }

    // If primary returned 403, 429, or 5xx, try secondary fallback if configured
    if (!response.ok && (response.status === 403 || response.status === 429 || response.status >= 500) && fallbackBaseUrl) {
      try {
        const fallbackRes = await callCompilerEndpoint(fallbackBaseUrl, apiKey);
        if (fallbackRes.ok) {
          response = fallbackRes;
        }
      } catch {
        // Ignore fallback failure and return primary response
      }
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      data = { message: text || 'Invalid JSON response from compiler API' };
    }

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Compiler API error (HTTP ${response.status})`;
      return NextResponse.json(
        {
          error: errorMsg,
          message: errorMsg,
          run: {
            stdout: '',
            stderr: errorMsg,
            code: response.status,
            output: errorMsg,
            signal: null,
          },
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    const errorMsg = error?.message || 'Failed to proxy compilation request';
    return NextResponse.json(
      {
        error: errorMsg,
        message: errorMsg,
        run: {
          stdout: '',
          stderr: `Network/Proxy Error: ${errorMsg}`,
          code: 500,
          output: `Network/Proxy Error: ${errorMsg}`,
          signal: null,
        },
      },
      { status: 500 }
    );
  }
}
