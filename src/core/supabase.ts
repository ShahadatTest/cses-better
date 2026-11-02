import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { UserProfile, SubmissionRecord } from './types';
import {
  getSolvedProblems,
  getAllNotes,
  saveNote,
  saveDraft,
  saveSubmission,
  getSubmissions,
} from './storage';

const DEFAULT_SUPABASE_URL = 'https://oxxctjyrtdgicbhmlhfy.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94eGN0anlydGRnaWNiaG1saGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NTEwNjQsImV4cCI6MjEwOTEyNzA2NH0.YlPXSsdZEG0-WlwKDi-YMsTC7Ov2HeL0hSQD9OYJ1lo';

const sanitizeEnv = (val?: string) => (val || '').replace(/^\uFEFF/, '').trim();

const supabaseUrl =
  sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey =
  sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co'
);

let supabaseInstance: SupabaseClient | null = null;

/**
 * Returns a singleton SupabaseClient.
 * Uses createBrowserClient in browser context to automatically sync session with cookies set by Next.js SSR.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!supabaseInstance) {
    if (typeof window !== 'undefined') {
      supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } else {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  }
  return supabaseInstance;
}

/**
 * Trigger GitHub OAuth sign-in flow
 */
export async function signInWithGitHub(redirectTo?: string): Promise<{ error: Error | null }> {
  const client = getSupabase();
  if (!client) {
    return {
      error: new Error(
        'Supabase is not configured yet. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      ),
    };
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const redirect = redirectTo || `${origin}/auth/callback`;

  const { error } = await client.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: redirect,
      scopes: 'read:user user:email',
    },
  });

  return { error: error as Error | null };
}

/**
 * Sign out user and clear session cookies
 */
export async function signOutUser(): Promise<{ error: Error | null }> {
  const client = getSupabase();
  if (!client) return { error: null };
  const { error } = await client.auth.signOut();
  return { error: error as Error | null };
}

/**
 * Convert Supabase user to UserProfile with accurate GitHub username & avatar extraction
 */
export function mapSupabaseUser(user: User): UserProfile {
  const metadata = user.user_metadata || {};
  const identityData = user.identities?.[0]?.identity_data || {};

  // GitHub returns user_name or preferred_username for the handle (e.g. codewithpom)
  const githubUser =
    metadata.user_name ||
    metadata.preferred_username ||
    metadata.nickname ||
    metadata.login ||
    identityData.user_name ||
    identityData.preferred_username ||
    identityData.nickname ||
    identityData.login;

  const fullName =
    metadata.full_name ||
    metadata.name ||
    identityData.full_name ||
    identityData.name;

  const displayName = githubUser || fullName || user.email?.split('@')[0] || 'Developer';
  const avatarUrl = metadata.avatar_url || metadata.picture || identityData.avatar_url;
  const provider = (user.app_metadata?.provider as any) || 'github';

  return {
    id: user.id,
    email: user.email,
    username: githubUser || undefined,
    displayName,
    avatarUrl,
    provider,
    createdAt: user.created_at,
  };
}

/**
 * Persists an individual problem note to Supabase cloud
 */
export async function saveUserNoteToCloud(
  userId: string,
  problemId: string,
  content: string
): Promise<boolean> {
  const client = getSupabase();
  if (!client || !userId || !problemId) return false;

  try {
    if (!content || content.trim() === '') {
      await client
        .from('user_notes')
        .delete()
        .eq('user_id', userId)
        .eq('problem_id', problemId);
    } else {
      await client.from('user_notes').upsert(
        {
          user_id: userId,
          problem_id: problemId,
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,problem_id' }
      );
    }
    return true;
  } catch (err) {
    console.warn('[Supabase Cloud Notes] Upsert error:', err);
    return false;
  }
}

/**
 * Sync user solved problems, drafts, submissions, and notes to Supabase (Row Level Security protected)
 */
export async function syncUserDataToCloud(
  userId: string,
  data: {
    solvedIds: string[];
    drafts: Record<string, string>;
    submissions: SubmissionRecord[];
    notes?: Record<string, string>;
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
        // key format: cses_draft_${problemId}_${language} or ${problemId}_${language}
        const cleaned = key.startsWith('cses_draft_') ? key.slice('cses_draft_'.length) : key;
        const parts = cleaned.split('_');
        const lang = parts.length >= 2 ? parts[parts.length - 1] : 'cpp';
        const pId = parts.length >= 2 ? parts.slice(0, -1).join('_') : parts[0] || '1068';
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

    // 4. Batch upsert notes
    if (data.notes) {
      const noteEntries = Object.entries(data.notes);
      if (noteEntries.length > 0) {
        const notesPayload = noteEntries
          .filter(([, content]) => Boolean(content && content.trim() !== ''))
          .map(([problemId, content]) => ({
            user_id: userId,
            problem_id: problemId,
            content,
            updated_at: new Date().toISOString(),
          }));

        if (notesPayload.length > 0) {
          await client.from('user_notes').upsert(notesPayload, {
            onConflict: 'user_id,problem_id',
          });
        }
      }
    }

    // 5. Batch upsert submissions
    if (data.submissions && data.submissions.length > 0) {
      const submissionsPayload = data.submissions.slice(0, 50).map((sub) => ({
        id: sub.id,
        user_id: userId,
        problem_id: sub.problemId,
        language: sub.language,
        verdict: sub.status,
        runtime_ms: sub.maxTimeMs || 0,
        char_count: sub.charCount || sub.code?.length || 0,
        created_at: new Date(sub.timestamp || Date.now()).toISOString(),
      }));

      await client.from('user_submissions').upsert(submissionsPayload, {
        onConflict: 'id',
      });
    }

    return true;
  } catch (err) {
    console.warn('[Supabase Sync] Cloud sync notice:', err);
    return false;
  }
}

/**
 * Fetch user solved problems, drafts, and notes from Supabase
 */
export async function fetchUserDataFromCloud(userId: string): Promise<{
  solvedIds: string[];
  drafts: Record<string, string>;
  notes: Record<string, string>;
} | null> {
  const client = getSupabase();
  if (!client || !userId) return null;

  try {
    const [solvedRes, draftsRes, notesRes] = await Promise.all([
      client.from('user_solved').select('problem_id').eq('user_id', userId),
      client.from('user_drafts').select('problem_id, language, code').eq('user_id', userId),
      client.from('user_notes').select('problem_id, content').eq('user_id', userId),
    ]);

    const solvedIds: string[] = (solvedRes.data || []).map((row: any) => row.problem_id);
    const drafts: Record<string, string> = {};
    const notes: Record<string, string> = {};

    if (draftsRes.data) {
      for (const d of draftsRes.data) {
        drafts[`cses_draft_${d.problem_id}_${d.language}`] = d.code;
      }
    }

    if (notesRes.data) {
      for (const n of notesRes.data) {
        if (n.content) {
          notes[n.problem_id] = n.content;
        }
      }
    }

    return { solvedIds, drafts, notes };
  } catch (err) {
    console.warn('[Supabase Fetch] Cloud fetch notice:', err);
    return null;
  }
}

/**
 * One-click bidirectional synchronization:
 * 1. Pushes all local progress (solves, drafts, submissions, notes) to cloud
 * 2. Pulls all cloud progress down to local storage
 */
export async function syncAllLocalProgressToCloud(
  userId: string
): Promise<{ success: boolean; syncedNotes: number; syncedSolves: number }> {
  if (!userId) return { success: false, syncedNotes: 0, syncedSolves: 0 };

  const localSolved = Array.from(getSolvedProblems());
  const localNotes = getAllNotes();
  const localSubmissions = getSubmissions();

  // Push local data up
  const pushOk = await syncUserDataToCloud(userId, {
    solvedIds: localSolved,
    drafts: {},
    submissions: localSubmissions,
    notes: localNotes,
  });

  // Pull cloud data down
  const cloudData = await fetchUserDataFromCloud(userId);
  let syncedSolves = localSolved.length;
  let syncedNotes = Object.keys(localNotes).length;

  if (cloudData) {
    // Merge cloud solved problems
    for (const pId of cloudData.solvedIds) {
      if (!localSolved.includes(pId)) {
        saveSubmission({
          id: `cloud-sync-${pId}-${Date.now()}`,
          problemId: pId,
          language: 'cpp',
          code: '',
          charCount: 0,
          timestamp: Date.now(),
          status: 'AC',
          passedCount: 1,
          totalCount: 1,
          maxTimeMs: 0,
          maxMemoryBytes: 0,
        });
      }
    }
    syncedSolves = Math.max(syncedSolves, cloudData.solvedIds.length);

    // Merge cloud drafts into local storage
    for (const [key, code] of Object.entries(cloudData.drafts)) {
      if (typeof window !== 'undefined' && code) {
        try {
          if (!window.localStorage.getItem(key)) {
            window.localStorage.setItem(key, code);
          }
        } catch {}
      }
    }

    // Merge cloud notes into local storage
    for (const [pId, content] of Object.entries(cloudData.notes)) {
      if (content && !localNotes[pId]) {
        saveNote(pId, content);
      }
    }
    syncedNotes = Math.max(syncedNotes, Object.keys(cloudData.notes).length);
  }

  return { success: pushOk, syncedNotes, syncedSolves };
}
