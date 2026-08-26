begin;

alter table public.entitlements enable row level security;

revoke all privileges on table public.entitlements from anon;
revoke all privileges on table public.entitlements from authenticated;

revoke all privileges (
  id,
  user_id,
  episode_id,
  source,
  created_at
) on table public.entitlements from anon;

revoke all privileges (
  id,
  user_id,
  episode_id,
  source,
  created_at
) on table public.entitlements from authenticated;

drop policy if exists entitlements_select_own on public.entitlements;

alter table public.story_submissions enable row level security;

revoke all privileges on table public.story_submissions from anon;
revoke all privileges on table public.story_submissions from authenticated;

revoke all privileges (
  id,
  created_at,
  story_title,
  story_category,
  story_body,
  permission_granted,
  name_preference,
  submitter_name,
  submitter_email,
  status
) on table public.story_submissions from anon;

revoke all privileges (
  id,
  created_at,
  story_title,
  story_category,
  story_body,
  permission_granted,
  name_preference,
  submitter_name,
  submitter_email,
  status
) on table public.story_submissions from authenticated;

grant insert (
  story_title,
  story_category,
  story_body,
  permission_granted,
  name_preference,
  submitter_name,
  submitter_email
) on table public.story_submissions to anon, authenticated;

drop policy if exists "Anyone can submit a story" on public.story_submissions;

create policy "Anyone can submit a story"
on public.story_submissions
as permissive
for insert
to anon, authenticated
with check (
  permission_granted = true
  and status = 'new'
);

commit;
