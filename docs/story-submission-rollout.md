# Story submission rollout

The public form uses its existing direct insert until a build sets
`VITE_STORY_SUBMISSION_API=true`. With the flag enabled, it sends submissions
to `/api/story-submission` and shows an error if the endpoint is unavailable.
The server writes the same seven contributor fields and sets `status = 'new'`.
Existing rows and editorial access are preserved.

## Stage on a nonproduction environment

1. Confirm the target has the existing `story_submissions` schema and the
   browser permissions from `20260826120000_restrict_browser_table_permissions.sql`.
   Check effective grants and RLS for `anon`, `authenticated`, and
   `service_role`, including the absence of browser read privileges. Confirm
   the service role can insert the listed columns, including `status`.
2. Apply only the reviewed additive migration
   `20261125180000_add_private_story_submission_rpc.sql` to the test database.
   Avoid applying all local migrations indiscriminately. The working tree also
   contains a separate unfinished weekly-reflection migration.
3. Configure server-side `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a
   random `STORY_RATE_LIMIT_SECRET` of at least 32 bytes, for example from
   `openssl rand -hex 32`. Use separate secrets and databases for preview and
   production. Enable Vercel system environment variables so `VERCEL=1`
   selects Vercel's platform-provided client IP header. Set
   `VITE_STORY_SUBMISSION_API=true` only for the test build.
4. Verify a synthetic story reaches the editorial queue with status `new`.
   Check invalid consent, an oversized payload, a filled honeypot, and a
   rejected sixth valid submission in one UTC clock hour. Confirm both
   browser roles are denied reads and cannot call the server-only function.
   Test on the Vercel preview to verify raw JSON handling and the actual
   client IP header.

The rate table contains HMACs rather than raw IPs, with no story text, names, or
email addresses. Counters cover a fixed UTC hour and cleanup runs on later
submissions, keeping the current and preceding windows when traffic resumes.
A shared connection shares its five-story quota. The limit and honeypot reduce
casual abuse. Distributed traffic may still require further controls if it becomes
a problem. Keep request bodies out of monitoring and external log sinks.

## Production cutover after approval

Apply the reviewed additive migration and configure the server secret. Deploy
the verified frontend build with the API flag enabled while direct inserts
remain available. Once the team confirms the endpoint and has allowed for cached
older clients, review and apply [the separate cutover SQL](close-direct-story-submission-writes.sql).
Confirm both browser roles lose direct INSERT access and retain no SELECT
access, and confirm the new endpoint still writes pending stories. The rate
limit can be bypassed through the legacy path until cutover closes it.

## Rollback order

If direct writes have closed, restore only the original column grant and
insert policy before rolling back the frontend to a build with API mode off.

```sql
begin;
grant insert (
  story_title, story_category, story_body, permission_granted,
  name_preference, submitter_name, submitter_email
) on public.story_submissions to anon, authenticated;

create policy "Anyone can submit a story"
on public.story_submissions
as permissive for insert to anon, authenticated
with check (permission_granted = true and status = 'new');
commit;
```

After the API deployment is no longer in use, its two database objects can be
removed with the following transaction. This leaves the story table and its
rows intact.

```sql
begin;
drop function public.submit_story_with_rate_limit(text, jsonb);
drop table public.story_submission_rate_limits;
commit;
```

## Release recovery reference

Verified on November 25, 2026. The production alias served Vercel deployment
`dpl_86uRVre43DVYYFQSaWVubYsYLYoq`, at
`https://voicework-7pf2koh6a-pamelaterrells-projects.vercel.app`, built from
`main` commit `d420dda4610cd773a1b9e4b1abc426ce2625604f`.
The local Git rollback tag is `rollback/stabileusa-production-2026-11-25`.
Verify the live alias still points to this deployment or record its current
replacement before starting production work. Confirm the deployment is
eligible for rollback and that the operator has access. Keep it available
throughout cutover.

### Production sequence

1. Confirm approval, a successful isolated preview, the live rollback target,
   and a current database recovery point. Record the existing story table
   grants and policy, and rehearse the permissions rollback in isolation.
   Check that private editorial access and browser read denial work before
   release. Do not run a bulk migration push from the working tree.
2. Apply only the reviewed additive migration to production. Confirm the
   RPC is executable by the service role and denied to browser roles.
   Keep the legacy INSERT grant and policy in place.
3. Configure the production-only `STORY_RATE_LIMIT_SECRET`. Confirm
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are the existing production
   server settings. Verify the Vercel system variables and client IP header.
   Preserve existing Stripe and Supabase authentication settings.
4. Build and deploy the verified commit using the production environment with
   `VITE_STORY_SUBMISSION_API=true`. The flag is compiled into the frontend.
   A preview build must never be promoted with its preview settings.
5. Verify public navigation, free playback, the existing sign-in and member
   route, membership pricing, and endpoint rejection responses that perform
   no writes. Have an authorized editor confirm the first naturally arriving
   submission reaches the existing private queue with status `new`, using
   operational metadata only. Do not create a test story in production. Keep
   legacy writes available until this confirmation and a suitable window for
   older open pages to refresh. Delay cutover if there is no confirmation.
6. Under separate approval, apply the reviewed cutover SQL. Compare effective
   grants and policies before and after. Confirm both browser roles lack
   SELECT and INSERT privileges and that the service role retains the exact
   access previously verified. Check the next naturally arriving submission
   in the private queue. Do not create a test story in production.
7. Monitor endpoint success and failure rates and smoke-test member navigation
   and access with an existing authorized account. An unconfirmed save shows
   an error and retains the draft in the open page. Ask users to keep that
   tab open during an outage. The form does not save a draft across reloads.
   Retrying an unchanged submission in the same open tab reuses its receipt.
   Reloading or changing the story starts a new submission.

### Recovery during a release

If the legacy INSERT path is still open, roll back the Vercel deployment to
the recorded live target. Use the Vercel dashboard or, when authorized,
`vercel rollback dpl_86uRVre43DVYYFQSaWVubYsYLYoq --scope pamelaterrells-projects`.
If the legacy path was closed, restore the original column grant and INSERT
policy first using the rollback SQL above. Then roll back Vercel and verify
the live alias, story-form availability, and member access. Vercel rollback
does not change Supabase grants or undo migrations. Leave the additive RPC
and counters in place during recovery. Neither recovery step removes stories
or touches member or subscription data.

## Submission retry receipts

Before deploying a build that sends `Idempotency-Key`, also apply
`20261125190000_add_story_submission_receipts.sql` after the original additive
migration. The old two-argument RPC remains available for rollback. The new
overload uses a private receipt to confirm the same validated submission
without writing a duplicate or charging the rate limit again. The receipt
contains a random ID and a fingerprint, with no story text or contact fields.
The form retains the ID for an unchanged retry in the open page. Reloading
the page loses the draft and its retry ID.

For hosted sign-in tests, set `VITE_PREVIEW_SITE_URL` on the release branch's
Preview environment only. Use the stable HTTPS Vercel branch alias and add its
exact `/auth/callback` URL and the `next=/members` and `next=/join` variants to
the isolated Supabase project's redirect allowlist. Production uses the
existing canonical callback.
