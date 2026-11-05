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
