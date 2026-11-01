import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { UserProfile, SubmissionRecord } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co'
);

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabaseInstance;
}

/**
 * Trigger Google OAuth sign-in flow
 */
export async function signInWithGoogle(redirectTo?: string): Promise<{ error: Error | null }> {
  const client = getSupabase();
  if (!client) {
    return {
      error: new Error('Supabase is not configured yet. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'),
    };
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const redirect = redirectTo || `${origin}/auth/callback`;

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirect,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  return { error: error as Error | null };
}

/**
 * Trigger GitHub OAuth sign-in flow
 */
export async function signInWithGitHub(redirectTo?: string): Promise<{ error: Error | null }> {
  const client = getSupabase();
  if (!client) {
    return {
      error: new Error('Supabase is not configured yet. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'),
    };
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const redirect = redirectTo || `${origin}/auth/callback`;

  const { error } = await client.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: redirect,
    },
  });

  return { error: error as Error | null };
}

/**
 * Sign out user
 */
export async function signOutUser(): Promise<{ error: Error | null }> {
  const client = getSupabase();
  if (!client) return { error: null };
  const { error } = await client.auth.signOut();
  return { error: error as Error | null };
}

/**
 * Convert Supabase user to UserProfile
 */
export function mapSupabaseUser(user: User): UserProfile {
  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email,
    displayName: metadata.full_name || metadata.name || user.email?.split('@')[0] || 'Anonymous',
    avatarUrl: metadata.avatar_url || metadata.picture,
    provider: (user.app_metadata?.provider as any) || 'google',
    createdAt: user.created_at,
  };
}

/**
 * Sync user solved problems, drafts, and submissions to Supabase (Row Level Security protected)
 */
export async function syncUserDataToCloud(
  userId: string,
  data: {
    solvedIds: string[];
    drafts: Record<string, string>;
    submissions: SubmissionRecord[];
  }
): Promise<boolean> {
  const client = getSupabase();
  if (!client || !userId) return false;

  try {
    // 1. Upsert profile record
    await client.from('profiles').upsert(
      {
        id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    // 2. Batch upsert solved problems
    if (data.solvedIds.length > 0) {
      const solvedPayload = data.solvedIds.map((problemId) => ({
        user_id: userId,
        problem_id: problemId,
        solved_at: new Date().toISOString(),
      }));
      await client.from('user_solved').upsert(solvedPayload, {
        onConflict: 'user_id,problem_id',
      });
    }

    // 3. Batch upsert recent drafts
    const draftEntries = Object.entries(data.drafts);
    if (draftEntries.length > 0) {
      const draftsPayload = draftEntries.map(([key, code]) => {
        // key format: cses_draft_${problemId}_${language} or similar
        const parts = key.split('_');
        const lang = parts.length >= 4 ? parts[parts.length - 1] : 'cpp';
        const pId = parts.length >= 4 ? parts[parts.length - 2] : '1068';
        return {
          user_id: userId,
          problem_id: pId,
          language: lang,
          code,
          updated_at: new Date().toISOString(),
        };
      });

      await client.from('user_drafts').upsert(draftsPayload, {
        onConflict: 'user_id,problem_id,language',
      });
    }

    return true;
  } catch (err) {
    console.warn('[Supabase Sync] Cloud sync notice:', err);
    return false;
  }
}

/**
 * Fetch user solved problems, drafts from Supabase
 */
export async function fetchUserDataFromCloud(userId: string): Promise<{
  solvedIds: string[];
  drafts: Record<string, string>;
} | null> {
  const client = getSupabase();
  if (!client || !userId) return null;

  try {
    const [solvedRes, draftsRes] = await Promise.all([
      client.from('user_solved').select('problem_id').eq('user_id', userId),
      client.from('user_drafts').select('problem_id, language, code').eq('user_id', userId),
    ]);

    const solvedIds: string[] = (solvedRes.data || []).map((row: any) => row.problem_id);
    const drafts: Record<string, string> = {};

    if (draftsRes.data) {
      for (const d of draftsRes.data) {
        drafts[`cses_draft_${d.problem_id}_${d.language}`] = d.code;
      }
    }

    return { solvedIds, drafts };
  } catch (err) {
    console.warn('[Supabase Fetch] Cloud fetch notice:', err);
    return null;
  }
}
