-- CSES Better PostgreSQL Schema (Supabase)
-- Provides multi-tenant data storage with Row Level Security (RLS)

-- 1. Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  cses_nick TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. User Solved Problems
CREATE TABLE IF NOT EXISTS public.user_solved (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  language TEXT DEFAULT 'cpp',
  solved_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_problem_unique UNIQUE (user_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_user_solved_user ON public.user_solved(user_id);
ALTER TABLE public.user_solved ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own solved problems"
  ON public.user_solved FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own solved problems"
  ON public.user_solved FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own solved problems"
  ON public.user_solved FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own solved problems"
  ON public.user_solved FOR DELETE
  USING (auth.uid() = user_id);

-- 3. User Drafts
CREATE TABLE IF NOT EXISTS public.user_drafts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_draft_unique UNIQUE (user_id, problem_id, language)
);

CREATE INDEX IF NOT EXISTS idx_user_drafts_user ON public.user_drafts(user_id);
ALTER TABLE public.user_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own drafts"
  ON public.user_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own drafts"
  ON public.user_drafts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. User Submissions History
CREATE TABLE IF NOT EXISTS public.user_submissions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  language TEXT NOT NULL,
  verdict TEXT NOT NULL,
  runtime_ms INT DEFAULT 0,
  char_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_submissions_user ON public.user_submissions(user_id);
ALTER TABLE public.user_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own submissions"
  ON public.user_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own submissions"
  ON public.user_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. User Notes (Cross-device note synchronization)
CREATE TABLE IF NOT EXISTS public.user_notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_note_unique UNIQUE (user_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_user_notes_user ON public.user_notes(user_id);
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notes"
  ON public.user_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
