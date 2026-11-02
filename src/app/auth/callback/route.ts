import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const origin = requestUrl.origin;

  if (error) {
    console.warn('[OAuth Callback] Provider returned error:', error, errorDescription);
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (code) {
    const cookieStore = cookies();
    const sanitizeEnv = (val?: string) => (val || '').replace(/^\uFEFF/, '').trim();
    const supabaseUrl =
      sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
      'https://oxxctjyrtdgicbhmlhfy.supabase.co';
    const supabaseAnonKey =
      sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94eGN0anlydGRnaWNiaG1saGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NTEwNjQsImV4cCI6MjEwOTEyNzA2NH0.YlPXSsdZEG0-WlwKDi-YMsTC7Ov2HeL0hSQD9OYJ1lo';

    if (supabaseUrl && supabaseAnonKey) {
      const response = NextResponse.redirect(`${origin}/?auth_success=true`);

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                cookieStore.set(name, value, options);
              } catch {
                // Ignore in edge contexts where cookies are read-only
              }
              response.cookies.set(name, value, options);
            });
          },
        },
      });

      try {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!exchangeError) {
          return response;
        }
        console.error('[OAuth Callback] Session exchange error:', exchangeError);
        return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(exchangeError.message)}`);
      } catch (err: any) {
        console.error('[OAuth Callback] Unexpected error during exchange:', err);
        return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(err?.message || 'Exchange failed')}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
