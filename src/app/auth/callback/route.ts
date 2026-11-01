import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/core/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.auth.exchangeCodeForSession(code);
      } catch (err) {
        console.error('[OAuth Callback] Session exchange error:', err);
      }
    }
  }

  // Redirect to app homepage or problemset
  return NextResponse.redirect(`${origin}/`);
}
