-- Lets a signed-in scorer delete their own account from the app. Run once in the Supabase SQL editor.
-- The backup row goes with it (on delete cascade). Only gully scorer logins can be removed here,
-- because other apps share this auth schema.
create or replace function public.gully_delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users
  where id = uid and email like '%@phone.gully-scorer.app';
  if not found then
    raise exception 'not a gully scorer account';
  end if;
end;
$$;

revoke all on function public.gully_delete_my_account() from public, anon;
grant execute on function public.gully_delete_my_account() to authenticated;
