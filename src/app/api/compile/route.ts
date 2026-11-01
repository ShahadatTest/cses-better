import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const apiKey = process.env.COMPILER_API_KEY || '';
    const baseUrl = process.env.COMPILER_BASE_URL || 'https://api.onlinecompiler.io/api/v2/piston';

    console.log('[DEBUG /api/compile] Lang:', payload.language, 'Version:', payload.version);
    console.log('[DEBUG /api/compile] Stdin length:', (payload.stdin || '').length, 'Stdin content:', JSON.stringify(payload.stdin));
    console.log('[DEBUG /api/compile] Code snippet:', (payload.files?.[0]?.content || payload.code || '').slice(0, 100));

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

    console.log('[DEBUG /api/compile] Response status:', response.status);
    console.log('[DEBUG /api/compile] Response data:', JSON.stringify(data));

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to proxy compilation request' },
      { status: 500 }
    );
  }
}
