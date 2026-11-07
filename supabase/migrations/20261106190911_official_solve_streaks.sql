create table public.user_official_solves (
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
create function public.keep_earliest_official_solve() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.accepted_at < new.accepted_at then new.accepted_at := old.accepted_at; end if;
  return new;
end;
$$;
create trigger keep_earliest_official_solve before update on public.user_official_solves for each row execute function public.keep_earliest_official_solve();

create table public.user_official_streak_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  cses_user_id text not null,
  timezone text not null,
  primary key (user_id, cses_user_id)
);
alter table public.user_official_streak_preferences enable row level security;
grant select, insert on public.user_official_streak_preferences to authenticated;
create policy "Users read own streak preferences" on public.user_official_streak_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own streak preferences" on public.user_official_streak_preferences for insert to authenticated with check ((select auth.uid()) = user_id);

create table if not exists public.user_starred (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null,
  starred_at timestamptz default now(),
  constraint user_starred_unique unique (user_id, problem_id)
);
create index if not exists idx_user_starred_user on public.user_starred(user_id);
create unique index if not exists user_starred_user_problem_unique on public.user_starred(user_id, problem_id);
alter table public.user_starred enable row level security;
grant select, insert, update, delete on public.user_starred to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_starred' and policyname = 'Users can manage own starred problems') then
    create policy "Users can manage own starred problems" on public.user_starred for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end $$;

