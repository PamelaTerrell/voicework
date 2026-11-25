begin;

create table public.story_submission_receipts (
  id uuid primary key,
  fingerprint bytea not null check (pg_catalog.octet_length(fingerprint) = 32)
);

alter table public.story_submission_receipts enable row level security;
revoke all privileges on public.story_submission_receipts from public, anon, authenticated;
grant select, insert, delete on public.story_submission_receipts to service_role;

-- Keep the earlier overload available to deployments that still use it.
create function public.submit_story_with_rate_limit(
  p_bucket text, p_story jsonb, p_submission_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  story_fingerprint bytea := pg_catalog.sha256(pg_catalog.convert_to(p_story::text, 'UTF8'));
begin
  insert into public.story_submission_receipts (id, fingerprint)
  values (p_submission_id, story_fingerprint)
  on conflict (id) do nothing;

  if not found then
    if exists (
      select 1 from public.story_submission_receipts
      where id = p_submission_id and fingerprint = story_fingerprint
    ) then
      return 'accepted';
    end if;
    return 'conflict';
  end if;

  if not public.submit_story_with_rate_limit(p_bucket, p_story) then
    delete from public.story_submission_receipts where id = p_submission_id;
    return 'rate_limited';
  end if;

  return 'accepted';
end;
$$;

revoke all privileges on function public.submit_story_with_rate_limit(text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_story_with_rate_limit(text, jsonb, uuid) to service_role;

commit;
