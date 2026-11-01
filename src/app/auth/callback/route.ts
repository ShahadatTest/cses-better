import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const response = NextResponse.redirect(`${origin}/`);

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
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          return response;
        }
        console.error('[OAuth Callback] Session exchange error:', error);
      } catch (err) {
        console.error('[OAuth Callback] Unexpected error during exchange:', err);
      }
    }
  }

  // Redirect to app homepage or problemset
  return NextResponse.redirect(`${origin}/`);
}
