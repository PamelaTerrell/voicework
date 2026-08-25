begin;

alter table public.profiles enable row level security;

revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.profiles from authenticated;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

commit;
