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

-- Opt-in world leaderboard: a scorer picks a nickname and appears with their totals. Off until they choose.
alter table public.gully_stats add column if not exists nickname text;
alter table public.gully_stats add column if not exists on_board boolean not null default false;
alter table public.gully_stats drop constraint if exists gully_stats_nick;
alter table public.gully_stats add constraint gully_stats_nick check (nickname is null or nickname ~ '^[A-Za-z0-9][A-Za-z0-9 ._-]{1,19}$');

create or replace function public.gully_top(metric text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select nickname, matches, runs, sixes, wickets
    from public.gully_stats
    where on_board and nickname is not null
    order by case metric when 'runs' then runs when 'sixes' then sixes when 'wickets' then wickets else matches end desc, updated_at asc
    limit 20
  ) t;
$$;
revoke all on function public.gully_top(text) from public;
grant execute on function public.gully_top(text) to anon, authenticated;

-- Everyone signed in is on the board by default, under a generated handle (never their number or player names).
-- They can rename or hide themselves any time.
alter table public.gully_stats alter column on_board set default true;
create or replace function public.gully_stats_handle() returns trigger language plpgsql as $t$
declare
  a text[] := array['Swift','Lucky','Bold','Sneaky','Mighty','Cool','Fiery','Rapid','Silent','Royal','Wild','Sharp','Brave','Jolly','Daring','Epic'];
  n text[] := array['Falcon','Tiger','Cobra','Striker','Blaster','Keeper','Spinner','Pacer','Wizard','Rocket','Bison','Panther','Hawk','Titan','Ninja','Legend'];
  h int := abs(hashtext(new.user_id::text));
begin
  if new.nickname is null then
    new.nickname := a[1 + h % 16] || ' ' || n[1 + (h / 16) % 16] || ' ' || (10 + (h / 256) % 90);
  end if;
  return new;
end $t$;
drop trigger if exists gully_stats_handle on public.gully_stats;
create trigger gully_stats_handle before insert on public.gully_stats for each row execute function public.gully_stats_handle();
update public.gully_stats set on_board = true where nickname is null;
