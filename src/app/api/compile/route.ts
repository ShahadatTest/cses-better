import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory sliding window rate limiter: 30 requests per 60 seconds per IP
const ipRateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

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

    const language = payload.language;
    if (!language || typeof language !== 'string') {
      return NextResponse.json({ error: 'Valid language string is required' }, { status: 400 });
    }

    // Code length check (max 64KB)
    const codeContent = payload.files?.[0]?.content || payload.code || '';
    if (codeContent.length > 64 * 1024) {
      return NextResponse.json({ error: 'Code size exceeds maximum limit of 64KB' }, { status: 413 });
    }

    // Stdin length check (max 150KB)
    if (payload.stdin && payload.stdin.length > 150 * 1024) {
      return NextResponse.json({ error: 'Stdin size exceeds maximum limit of 150KB' }, { status: 413 });
    }

    const apiKey = process.env.COMPILER_API_KEY || '';
    const baseUrl = process.env.COMPILER_BASE_URL || 'https://api.onlinecompiler.io/api/v2/piston';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = apiKey;
    }

    const response = await fetch(`${baseUrl}/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      data = { message: text || 'Invalid JSON response from compiler API' };
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to proxy compilation request' },
      { status: 500 }
    );
  }
}
