import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('cses_session', '', {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 0,
  });
  return response;
}
