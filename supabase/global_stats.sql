-- Anonymous totals for the "Gully world" card. Each signed-in scorer writes one row of plain numbers (no names).
-- Run once. The card reads gully_global(), which anyone may call.
create table if not exists public.gully_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  matches int not null default 0,
  runs int not null default 0,
  sixes int not null default 0,
  wickets int not null default 0,
  best_score int not null default 0,
  updated_at timestamptz not null default now(),
  constraint gully_stats_sane check (
    matches between 0 and 100000 and runs between 0 and 10000000 and sixes between 0 and 1000000
    and wickets between 0 and 1000000 and best_score between 0 and 2000)
);
-- The clock is the server's, never the client's.
create or replace function public.gully_stats_touch() returns trigger language plpgsql as $t$
begin new.updated_at := now(); return new; end $t$;
drop trigger if exists gully_stats_touch on public.gully_stats;
create trigger gully_stats_touch before insert or update on public.gully_stats for each row execute function public.gully_stats_touch();
alter table public.gully_stats enable row level security;
drop policy if exists "own stats" on public.gully_stats;
create policy "own stats" on public.gully_stats for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.gully_global()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'people', (select count(*) from auth.users where email like '%@phone.gully-scorer.app'),
    'active7', (select count(*) from public.gully_backups where updated_at > now() - interval '7 days'),
    'matches', (select coalesce(sum(case when jsonb_typeof(data -> 'matches') = 'array' then jsonb_array_length(data -> 'matches') else 0 end), 0) from public.gully_backups),
    'runs', (select coalesce(sum(runs), 0) from public.gully_stats),
    'sixes', (select coalesce(sum(sixes), 0) from public.gully_stats),
    'wickets', (select coalesce(sum(wickets), 0) from public.gully_stats),
    'best', (select coalesce(max(best_score), 0) from public.gully_stats),
    'reporting', (select count(*) from public.gully_stats)
  );
$$;
revoke all on function public.gully_global() from public;
grant execute on function public.gully_global() to anon, authenticated;
