begin;

drop policy if exists "Anyone can submit a story" on public.story_submissions;
revoke insert on table public.story_submissions from public, anon, authenticated;
revoke insert (
  story_title, story_category, story_body, permission_granted,
  name_preference, submitter_name, submitter_email
) on public.story_submissions from public, anon, authenticated;

commit;
