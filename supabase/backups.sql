-- One row per signed-in scorer holding their whole history. Run once in the Supabase SQL editor.
create table if not exists public.gully_backups (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint gully_backups_size check (pg_column_size(data) < 5000000)
);

alter table public.gully_backups enable row level security;

drop policy if exists "own backup read" on public.gully_backups;
drop policy if exists "own backup insert" on public.gully_backups;
drop policy if exists "own backup update" on public.gully_backups;
create policy "own backup read" on public.gully_backups for select to authenticated using (auth.uid() = user_id);
create policy "own backup insert" on public.gully_backups for insert to authenticated with check (auth.uid() = user_id);
create policy "own backup update" on public.gully_backups for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
