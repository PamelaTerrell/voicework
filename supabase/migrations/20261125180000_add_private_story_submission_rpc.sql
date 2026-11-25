begin;

create table public.story_submission_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  submissions integer not null check (submissions between 1 and 5),
  primary key (bucket, window_start)
);

create index story_submission_rate_limits_window_idx
  on public.story_submission_rate_limits (window_start);

alter table public.story_submission_rate_limits enable row level security;
revoke all privileges on public.story_submission_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.story_submission_rate_limits to service_role;

create function public.submit_story_with_rate_limit(p_bucket text, p_story jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_window timestamptz := pg_catalog.date_trunc('hour', pg_catalog.statement_timestamp(), 'UTC');
begin
  -- Limit concurrent cleanup work without serializing all submissions.
  if pg_catalog.pg_try_advisory_xact_lock(804341, 1) then
    delete from public.story_submission_rate_limits
      where window_start < current_window - interval '1 hour';
  end if;

  insert into public.story_submission_rate_limits as limits (bucket, window_start, submissions)
    values (p_bucket, current_window, 1)
    on conflict (bucket, window_start) do update
      set submissions = limits.submissions + 1
      where limits.submissions < 5;

  if not found then
    return false;
  end if;

  insert into public.story_submissions (
    story_title, story_category, story_body, permission_granted,
    name_preference, submitter_name, submitter_email, status
  ) values (
    p_story ->> 'story_title', p_story ->> 'story_category', p_story ->> 'story_body',
    (p_story ->> 'permission_granted')::boolean, p_story ->> 'name_preference',
    p_story ->> 'submitter_name', p_story ->> 'submitter_email', 'new'
  );

  return true;
end;
$$;

revoke all privileges on function public.submit_story_with_rate_limit(text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_story_with_rate_limit(text, jsonb) to service_role;

commit;
