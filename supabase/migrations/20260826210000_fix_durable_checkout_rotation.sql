begin;

create or replace function public.claim_subscription_checkout_attempt(
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
    stripe_expires_at = greatest(
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

revoke all on function public.claim_subscription_checkout_attempt(
  uuid, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.claim_subscription_checkout_attempt(
  uuid, text, text, text, text
) to service_role;

commit;
