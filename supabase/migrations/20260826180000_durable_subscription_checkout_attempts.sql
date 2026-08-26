begin;

create table public.subscription_checkout_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempt_id uuid not null unique default pg_catalog.gen_random_uuid(),
  generation bigint not null default 1 check (generation > 0),
  state text not null check (
    state in ('creating', 'open', 'completed', 'expired', 'blocked')
  ),
  stripe_customer_id text not null unique check (stripe_customer_id <> ''),
  stripe_checkout_session_id text unique check (
    stripe_checkout_session_id is null or stripe_checkout_session_id <> ''
  ),
  stripe_price_id text not null check (stripe_price_id <> ''),
  success_url text not null check (success_url <> ''),
  cancel_url text not null check (cancel_url <> ''),
  stripe_expires_at bigint not null check (stripe_expires_at > 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  terminal_at timestamptz,
  check (
    (
      state = 'creating'
      and stripe_checkout_session_id is null
      and lease_token is not null
      and lease_expires_at is not null
      and terminal_at is null
    )
    or (
      state = 'open'
      and stripe_checkout_session_id is not null
      and lease_token is null
      and lease_expires_at is null
      and terminal_at is null
    )
    or (
      state = 'completed'
      and stripe_checkout_session_id is not null
      and lease_token is null
      and lease_expires_at is null
      and terminal_at is not null
    )
    or (
      state = 'expired'
      and lease_token is null
      and lease_expires_at is null
      and terminal_at is not null
    )
    or (
      state = 'blocked'
      and lease_token is null
      and lease_expires_at is null
      and terminal_at is not null
    )
  )
);

alter table public.subscription_checkout_attempts enable row level security;

revoke all privileges on table public.subscription_checkout_attempts from public;
revoke all privileges on table public.subscription_checkout_attempts from anon;
revoke all privileges on table public.subscription_checkout_attempts from authenticated;

revoke all privileges (
  user_id,
  attempt_id,
  generation,
  state,
  stripe_customer_id,
  stripe_checkout_session_id,
  stripe_price_id,
  success_url,
  cancel_url,
  stripe_expires_at,
  lease_token,
  lease_expires_at,
  created_at,
  updated_at,
  terminal_at
) on table public.subscription_checkout_attempts from public;

revoke all privileges (
  user_id,
  attempt_id,
  generation,
  state,
  stripe_customer_id,
  stripe_checkout_session_id,
  stripe_price_id,
  success_url,
  cancel_url,
  stripe_expires_at,
  lease_token,
  lease_expires_at,
  created_at,
  updated_at,
  terminal_at
) on table public.subscription_checkout_attempts from anon;

revoke all privileges (
  user_id,
  attempt_id,
  generation,
  state,
  stripe_customer_id,
  stripe_checkout_session_id,
  stripe_price_id,
  success_url,
  cancel_url,
  stripe_expires_at,
  lease_token,
  lease_expires_at,
  created_at,
  updated_at,
  terminal_at
) on table public.subscription_checkout_attempts from authenticated;

grant select on table public.subscription_checkout_attempts
to service_role;

create function public.claim_subscription_checkout_attempt(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_price_id text,
  p_success_url text,
  p_cancel_url text
)
returns table (
  outcome text,
  attempt_id uuid,
  generation bigint,
  lease_token uuid,
  stripe_checkout_session_id text,
  stripe_customer_id text,
  stripe_price_id text,
  success_url text,
  cancel_url text,
  stripe_expires_at bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.subscription_checkout_attempts%rowtype;
  v_inserted boolean;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_lease_token uuid := pg_catalog.gen_random_uuid();
  v_new_stripe_expires_at bigint :=
    pg_catalog.floor(pg_catalog.date_part('epoch', v_now))::bigint + 2100;
begin
  if p_user_id is null
    or p_stripe_customer_id is null or p_stripe_customer_id = ''
    or p_stripe_price_id is null or p_stripe_price_id = ''
    or p_success_url is null or p_success_url = ''
    or p_cancel_url is null or p_cancel_url = '' then
    raise exception 'invalid checkout attempt claim';
  end if;

  insert into public.subscription_checkout_attempts (
    user_id,
    attempt_id,
    generation,
    state,
    stripe_customer_id,
    stripe_price_id,
    success_url,
    cancel_url,
    stripe_expires_at,
    lease_token,
    lease_expires_at,
    created_at,
    updated_at
  ) values (
    p_user_id,
    pg_catalog.gen_random_uuid(),
    1,
    'creating',
    p_stripe_customer_id,
    p_stripe_price_id,
    p_success_url,
    p_cancel_url,
    v_new_stripe_expires_at,
    v_lease_token,
    v_now + interval '2 minutes',
    v_now,
    v_now
  )
  on conflict (user_id) do nothing;
  v_inserted := found;

  select *
  into strict v_attempt
  from public.subscription_checkout_attempts
  where user_id = p_user_id
  for update;

  if v_attempt.state = 'blocked' then
    return query select
      'blocked'::text, null::uuid, null::bigint, null::uuid, null::text,
      null::text, null::text, null::text, null::text, null::bigint;
    return;
  end if;

  if v_attempt.state in ('creating', 'open')
    and v_attempt.stripe_customer_id <> p_stripe_customer_id then
    update public.subscription_checkout_attempts
    set
      state = 'blocked',
      lease_token = null,
      lease_expires_at = null,
      terminal_at = v_now,
      updated_at = v_now
    where user_id = p_user_id;

    return query select
      'blocked'::text, null::uuid, null::bigint, null::uuid, null::text,
      null::text, null::text, null::text, null::text, null::bigint;
    return;
  end if;

  if v_attempt.state = 'open' then
    return query select
      'open'::text,
      v_attempt.attempt_id,
      v_attempt.generation,
      null::uuid,
      v_attempt.stripe_checkout_session_id,
      v_attempt.stripe_customer_id,
      v_attempt.stripe_price_id,
      v_attempt.success_url,
      v_attempt.cancel_url,
      v_attempt.stripe_expires_at;
    return;
  end if;

  if v_attempt.state = 'creating' and v_attempt.lease_expires_at > v_now then
    if v_inserted and v_attempt.lease_token = v_lease_token then
      return query select
        'new'::text,
        v_attempt.attempt_id,
        v_attempt.generation,
        v_attempt.lease_token,
        null::text,
        v_attempt.stripe_customer_id,
        v_attempt.stripe_price_id,
        v_attempt.success_url,
        v_attempt.cancel_url,
        v_attempt.stripe_expires_at;
    else
      return query select
        'busy'::text, null::uuid, null::bigint, null::uuid, null::text,
        null::text, null::text, null::text, null::text, null::bigint;
    end if;
    return;
  end if;

  if v_attempt.state = 'creating' then
    update public.subscription_checkout_attempts
    set
      lease_token = v_lease_token,
      lease_expires_at = v_now + interval '2 minutes',
      updated_at = v_now
    where user_id = p_user_id
    returning * into strict v_attempt;

    return query select
      'reclaimed'::text,
      v_attempt.attempt_id,
      v_attempt.generation,
      v_attempt.lease_token,
      null::text,
      v_attempt.stripe_customer_id,
      v_attempt.stripe_price_id,
      v_attempt.success_url,
      v_attempt.cancel_url,
      v_attempt.stripe_expires_at;
    return;
  end if;

  update public.subscription_checkout_attempts as attempts
  set
    attempt_id = pg_catalog.gen_random_uuid(),
    generation = attempts.generation + 1,
    state = 'creating',
    stripe_customer_id = p_stripe_customer_id,
    stripe_checkout_session_id = null,
    stripe_price_id = p_stripe_price_id,
    success_url = p_success_url,
    cancel_url = p_cancel_url,
    stripe_expires_at = pg_catalog.greatest(
      v_new_stripe_expires_at,
      attempts.stripe_expires_at + 1
    ),
    lease_token = v_lease_token,
    lease_expires_at = v_now + interval '2 minutes',
    created_at = v_now,
    updated_at = v_now,
    terminal_at = null
  where attempts.user_id = p_user_id
    and attempts.state in ('completed', 'expired')
  returning * into strict v_attempt;

  return query select
    'rotated'::text,
    v_attempt.attempt_id,
    v_attempt.generation,
    v_attempt.lease_token,
    null::text,
    v_attempt.stripe_customer_id,
    v_attempt.stripe_price_id,
    v_attempt.success_url,
    v_attempt.cancel_url,
    v_attempt.stripe_expires_at;
end;
$$;

create function public.bind_subscription_checkout_session(
  p_user_id uuid,
  p_attempt_id uuid,
  p_generation bigint,
  p_lease_token uuid,
  p_stripe_customer_id text,
  p_stripe_checkout_session_id text,
  p_stripe_expires_at bigint,
  p_session_state text
)
returns table (
  outcome text,
  stripe_checkout_session_id text,
  stripe_expires_at bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.subscription_checkout_attempts%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_stripe_customer_id is null
    or p_stripe_customer_id = ''
    or p_stripe_checkout_session_id is null
    or p_stripe_checkout_session_id = ''
    or p_stripe_expires_at is null
    or p_stripe_expires_at <= 0
    or p_session_state not in ('open', 'completed', 'expired') then
    raise exception 'invalid checkout session binding';
  end if;

  select *
  into v_attempt
  from public.subscription_checkout_attempts
  where user_id = p_user_id
  for update;

  if not found
    or v_attempt.state <> 'creating'
    or v_attempt.attempt_id <> p_attempt_id
    or v_attempt.generation <> p_generation
    or v_attempt.lease_token <> p_lease_token
    or v_attempt.lease_expires_at <= v_now
    or v_attempt.stripe_customer_id <> p_stripe_customer_id
    or v_attempt.stripe_checkout_session_id is not null
    or v_attempt.stripe_expires_at <> p_stripe_expires_at then
    return query select 'stale'::text, null::text, null::bigint;
    return;
  end if;

  if p_session_state = 'open'
    and p_stripe_expires_at <= pg_catalog.floor(
      pg_catalog.date_part('epoch', v_now)
    )::bigint then
    return query select 'stale'::text, null::text, null::bigint;
    return;
  end if;

  begin
    update public.subscription_checkout_attempts
    set
      state = p_session_state,
      stripe_checkout_session_id = p_stripe_checkout_session_id,
      lease_token = null,
      lease_expires_at = null,
      terminal_at = case
        when p_session_state = 'open' then null
        else v_now
      end,
      updated_at = v_now
    where user_id = p_user_id;
  exception when unique_violation then
    update public.subscription_checkout_attempts
    set
      state = 'blocked',
      lease_token = null,
      lease_expires_at = null,
      terminal_at = v_now,
      updated_at = v_now
    where user_id = p_user_id;

    return query select 'blocked'::text, null::text, null::bigint;
    return;
  end;

  return query select
    ('bound_' || p_session_state)::text,
    p_stripe_checkout_session_id,
    p_stripe_expires_at;
end;
$$;

create function public.transition_subscription_checkout_attempt(
  p_user_id uuid,
  p_attempt_id uuid,
  p_generation bigint,
  p_stripe_checkout_session_id text,
  p_lease_token uuid,
  p_target_state text
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.subscription_checkout_attempts%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_target_state not in ('completed', 'expired', 'blocked') then
    raise exception 'invalid checkout attempt transition';
  end if;

  select *
  into v_attempt
  from public.subscription_checkout_attempts
  where user_id = p_user_id
  for update;

  if not found
    or v_attempt.attempt_id <> p_attempt_id
    or v_attempt.generation <> p_generation then
    return query select 'stale'::text;
    return;
  end if;

  if v_attempt.state = p_target_state then
    if p_target_state in ('completed', 'expired') and (
      p_stripe_checkout_session_id is null
      or v_attempt.stripe_checkout_session_id <> p_stripe_checkout_session_id
    ) then
      return query select 'stale'::text;
      return;
    end if;
    return query select 'noop'::text;
    return;
  end if;

  if p_target_state in ('completed', 'expired') then
    if v_attempt.state <> 'open'
      or p_stripe_checkout_session_id is null
      or v_attempt.stripe_checkout_session_id <> p_stripe_checkout_session_id then
      return query select 'stale'::text;
      return;
    end if;
  else
    if v_attempt.state = 'open' then
      if p_stripe_checkout_session_id is null
        or v_attempt.stripe_checkout_session_id <> p_stripe_checkout_session_id then
        return query select 'stale'::text;
        return;
      end if;
    elsif v_attempt.state = 'creating' then
      if p_lease_token is null
        or v_attempt.lease_token <> p_lease_token
        or v_attempt.lease_expires_at <= v_now
        or v_attempt.stripe_checkout_session_id is not null then
        return query select 'stale'::text;
        return;
      end if;
    else
      return query select 'stale'::text;
      return;
    end if;
  end if;

  update public.subscription_checkout_attempts
  set
    state = p_target_state,
    lease_token = null,
    lease_expires_at = null,
    terminal_at = v_now,
    updated_at = v_now
  where user_id = p_user_id;

  return query select 'transitioned'::text;
end;
$$;

create function public.resolve_blocked_subscription_checkout_attempt(
  p_user_id uuid,
  p_attempt_id uuid,
  p_generation bigint,
  p_expected_stripe_checkout_session_id text,
  p_resolution_state text
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.subscription_checkout_attempts%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_resolution_state not in ('completed', 'expired')
    or (p_expected_stripe_checkout_session_id is null
      and p_resolution_state <> 'expired') then
    raise exception 'invalid blocked checkout attempt resolution';
  end if;

  select *
  into v_attempt
  from public.subscription_checkout_attempts
  where user_id = p_user_id
  for update;

  if not found
    or v_attempt.state <> 'blocked'
    or v_attempt.attempt_id <> p_attempt_id
    or v_attempt.generation <> p_generation
    or v_attempt.stripe_checkout_session_id
      is distinct from p_expected_stripe_checkout_session_id then
    return query select 'stale'::text;
    return;
  end if;

  update public.subscription_checkout_attempts
  set
    state = p_resolution_state,
    lease_token = null,
    lease_expires_at = null,
    terminal_at = v_now,
    updated_at = v_now
  where user_id = p_user_id;

  return query select 'resolved'::text;
end;
$$;

revoke all on function public.claim_subscription_checkout_attempt(
  uuid, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.bind_subscription_checkout_session(
  uuid, uuid, bigint, uuid, text, text, bigint, text
) from public, anon, authenticated;
revoke all on function public.transition_subscription_checkout_attempt(
  uuid, uuid, bigint, text, uuid, text
) from public, anon, authenticated;
revoke all on function public.resolve_blocked_subscription_checkout_attempt(
  uuid, uuid, bigint, text, text
) from public, anon, authenticated;

grant execute on function public.claim_subscription_checkout_attempt(
  uuid, text, text, text, text
) to service_role;
grant execute on function public.bind_subscription_checkout_session(
  uuid, uuid, bigint, uuid, text, text, bigint, text
) to service_role;
grant execute on function public.transition_subscription_checkout_attempt(
  uuid, uuid, bigint, text, uuid, text
) to service_role;
grant execute on function public.resolve_blocked_subscription_checkout_attempt(
  uuid, uuid, bigint, text, text
) to service_role;

commit;
