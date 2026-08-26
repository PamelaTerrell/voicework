# Durable subscription Checkout rollout

The durable attempt migration must be applied before deploying application code that depends on it. Checkout must remain fail-closed if the table or RPCs are unavailable.

This timestamped migration is one-shot. After it has been applied successfully, do not execute the migration file directly again: its `create table` and `create function` statements are intentionally non-idempotent, so a direct second application fails and rolls back its transaction.

The corrective migration `20260826210000_fix_durable_checkout_rotation.sql` replaces only the claim RPC to use PostgreSQL's unqualified `greatest(...)` SQL expression during terminal-generation rotation. Fresh environments must apply `20260826180000_durable_subscription_checkout_attempts.sql` and then the corrective migration in timestamp order. Environments where the original migration is already applied must apply only the corrective migration and must not replay or rewrite the original.

Immediately before the production deployment, manually inspect all existing open test-mode subscription Checkout Sessions and expire every one. The application deliberately does not list, discover, adopt, or expire any Session that is not already bound to a trusted `subscription_checkout_attempts` row.

Rollout order:

1. Confirm the existing open test Sessions have been reviewed and expired.
2. Apply all pending durable checkout-attempt migrations in timestamp order, including the corrective rotation migration.
3. Verify `anon` and `authenticated` have no table, column, or RPC access and `service_role` can call the four RPCs.
4. Deploy the application code.
5. Verify one authenticated test user receives one reusable open Session across concurrent requests and a later retry.
6. Monitor generic busy, blocked, bind-failure, and owned-Session invalidation outcomes without logging identifiers or Checkout URLs.

Do not roll back to the ten-minute idempotency-window implementation while checkout remains enabled. A safe application rollback must disable subscription Checkout or retain compatibility with the durable attempt RPCs. Leave the table and functions in place until every application-owned Session is terminal.

## Blocked-attempt recovery

`resolve_blocked_subscription_checkout_attempt` is an operational, service-role-only RPC. It has no application or browser endpoint. An operator may call it only after manually proving all of the following:

1. A bound Session is complete or expired, or has been explicitly expired in Stripe.
2. Any ambiguous unbound Stripe creation has been resolved.
3. No unsafe open Session remains for the blocked generation.
4. The ordinary checkout endpoint will perform fresh membership and customer verification before it can rotate the terminal generation.

The operator must provide the exact user ID, attempt ID, generation, expected stored Session ID, and terminal resolution state. For a safely resolved unbound attempt, the expected Session ID is explicitly `null` and the only permitted resolution state is `expired`. A bound Session ID and the stored integer expiration are preserved. Every identity or state mismatch returns `stale`; the RPC never creates a replacement attempt.

### Aged unbound attempts

Stripe requires a new Checkout Session expiration to remain at least 30 minutes in the future. The application reserves an additional two-minute transit buffer and will not call Stripe when a persisted expiration is 32 minutes or less from the current time. The current lease owner instead asks `transition_subscription_checkout_attempt` to atomically move the exact unbound `creating` generation to `blocked`. That transition requires the exact user ID, attempt ID, generation, current unexpired lease token, and a still-null Session ID. It preserves the attempt identity, customer, price, URLs, expiration, and null Session ID. The browser receives only the generic safe failure response.

Treat an aged unbound attempt as ambiguous: Stripe may have received an earlier request even though no Session ID was stored. Before resolving it, an operator using service-role access must:

1. Correlate Stripe request evidence for that exact attempt without creating, listing, searching for, discovering, or adopting a replacement Session in application code.
2. Determine whether Stripe created a Session from the ambiguous request.
3. Prove that any such Session is complete or expired, or explicitly expire the exact proven Session in Stripe.
4. Prove that no open or otherwise uncertain Session remains.
5. Verify that the database row is still the exact blocked user, attempt ID, and generation with a null stored Session ID.
6. Invoke `resolve_blocked_subscription_checkout_attempt` with that exact identity, `p_expected_stripe_checkout_session_id` explicitly set to `null`, and `p_resolution_state` set to `expired`.
7. Require the minimal `resolved` outcome; treat every error or `stale` result as unresolved.

Never resolve or rotate a blocked attempt while an open or uncertain Stripe Session may exist. Recovery does not directly create or rotate an attempt. After valid resolution, only a later ordinary authenticated checkout request may rotate the terminal generation, and that request first repeats current membership, customer, and subscription eligibility checks.
