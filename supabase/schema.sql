-- CSES Better PostgreSQL Schema (Supabase)
-- Provides hardened multi-tenant data storage with Row Level Security (RLS)
-- All policies restrict access TO authenticated role, ensuring unauthenticated/anon queries fail safely and cleanly

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
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

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
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own solved problems"
  ON public.user_solved FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own solved problems"
  ON public.user_solved FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own solved problems"
  ON public.user_solved FOR DELETE
  TO authenticated
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
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own drafts"
  ON public.user_drafts FOR ALL
  TO authenticated
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
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own submissions"
  ON public.user_submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own submissions"
  ON public.user_submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own submissions"
  ON public.user_submissions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

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
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. User Starred Problems (Cross-device bookmark synchronization)
CREATE TABLE IF NOT EXISTS public.user_starred (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  starred_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_starred_unique UNIQUE (user_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_user_starred_user ON public.user_starred(user_id);
ALTER TABLE public.user_starred ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own starred problems"
  ON public.user_starred FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
create table public.user_problem_lists (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  problem_ids text[] not null default '{}',
  revision integer not null default 1 check (revision > 0),
  deleted boolean not null default false,
  primary key (user_id, id)
);
alter table public.user_problem_lists enable row level security;
grant select, insert, update on public.user_problem_lists to authenticated;
create policy "Users read own lists" on public.user_problem_lists for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own lists" on public.user_problem_lists for insert to authenticated with check ((select auth.uid()) = user_id and revision = 1);
create policy "Users update own lists" on public.user_problem_lists for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create function public.check_list_revision() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.revision <> old.revision + 1 then raise exception 'Invalid list revision'; end if;
  return new;
end;
$$;
create trigger check_list_revision before update on public.user_problem_lists for each row execute function public.check_list_revision();

create table if not exists public.user_official_solves (
  user_id uuid not null references auth.users(id) on delete cascade,
  cses_user_id text not null,
  problem_id text not null,
  accepted_at timestamptz not null,
  primary key (user_id, cses_user_id, problem_id)
);
alter table public.user_official_solves enable row level security;
grant select, insert, update on public.user_official_solves to authenticated;
create policy "Users read own official solves" on public.user_official_solves for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own official solves" on public.user_official_solves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own official solves" on public.user_official_solves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace function public.keep_earliest_official_solve() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.accepted_at < new.accepted_at then new.accepted_at := old.accepted_at; end if;
  return new;
end;
$$;
drop trigger if exists keep_earliest_official_solve on public.user_official_solves;
create trigger keep_earliest_official_solve before update on public.user_official_solves for each row execute function public.keep_earliest_official_solve();

create table if not exists public.user_official_streak_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  cses_user_id text not null,
  timezone text not null,
  primary key (user_id, cses_user_id)
);
alter table public.user_official_streak_preferences enable row level security;
grant select, insert on public.user_official_streak_preferences to authenticated;
create policy "Users read own streak preferences" on public.user_official_streak_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own streak preferences" on public.user_official_streak_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
