import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  "supabase/migrations/20260826180000_durable_subscription_checkout_attempts.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const normalized = migration.replace(/\s+/g, " ").trim().toLowerCase();

describe("durable subscription checkout migration contract", () => {
  it("creates exactly one constrained current row per authenticated user", () => {
    expect(normalized).toContain(
      "create table public.subscription_checkout_attempts ( user_id uuid primary key references auth.users(id) on delete cascade",
    );
    for (const column of [
      "attempt_id uuid not null unique",
      "generation bigint not null default 1 check (generation > 0)",
      "stripe_customer_id text not null unique",
      "stripe_checkout_session_id text unique check ( stripe_checkout_session_id is null or stripe_checkout_session_id <> '' )",
      "stripe_price_id text not null",
      "success_url text not null",
      "cancel_url text not null",
      "stripe_expires_at bigint not null check (stripe_expires_at > 0)",
      "lease_token uuid",
      "lease_expires_at timestamptz",
      "created_at timestamptz not null",
      "updated_at timestamptz not null",
      "terminal_at timestamptz",
    ]) expect(normalized).toContain(column);
    expect(normalized).toContain(
      "state in ('creating', 'open', 'completed', 'expired', 'blocked')",
    );
    expect(normalized).toContain(
      "state = 'open' and stripe_checkout_session_id is not null and lease_token is null",
    );
    expect(normalized).toContain(
      "state = 'expired' and lease_token is null and lease_expires_at is null and terminal_at is not null",
    );
  });

  it("enables RLS and grants zero browser table or column access", () => {
    expect(normalized).toContain(
      "alter table public.subscription_checkout_attempts enable row level security",
    );
    for (const role of ["public", "anon", "authenticated"]) {
      expect(normalized).toContain(
        `revoke all privileges on table public.subscription_checkout_attempts from ${role}`,
      );
      expect(normalized).toMatch(
        new RegExp(
          `revoke all privileges \\([^;]+\\) on table public\\.subscription_checkout_attempts from ${role}`,
        ),
      );
      expect(normalized).not.toMatch(
        new RegExp(`grant [^;]+ on table public\\.subscription_checkout_attempts to ${role}`),
      );
    }
    expect(normalized).not.toContain("create policy");
  });

  it("uses atomic insert-or-lock claim and preserves identity on stale-lease recovery", () => {
    expect(normalized).toContain("on conflict (user_id) do nothing");
    expect(normalized).toContain(
      "from public.subscription_checkout_attempts where user_id = p_user_id for update",
    );
    expect(normalized).toContain(
      "if v_attempt.state = 'creating' and v_attempt.lease_expires_at > v_now",
    );
    expect(normalized).toContain(
      "if v_attempt.state = 'creating' then update public.subscription_checkout_attempts set lease_token = v_lease_token",
    );
    const staleLeaseSection = normalized.match(
      /if v_attempt\.state = 'creating' then update public\.subscription_checkout_attempts set lease_token = v_lease_token[^;]+;/,
    )?.[0] ?? "";
    expect(staleLeaseSection).not.toContain("attempt_id =");
    expect(staleLeaseSection).not.toContain("generation =");
    expect(staleLeaseSection).not.toContain("stripe_expires_at =");
    expect(normalized).toContain(
      "v_new_stripe_expires_at bigint := pg_catalog.floor(pg_catalog.date_part('epoch', v_now))::bigint + 2100",
    );
    expect(normalized).toContain(
      "stripe_expires_at = pg_catalog.greatest( v_new_stripe_expires_at, attempts.stripe_expires_at + 1 )",
    );
    for (const outcome of ["new", "reclaimed", "rotated", "open", "busy", "blocked"]) {
      expect(normalized).toContain(`'${outcome}'::text`);
    }
  });

  it("lease-checks exact open or terminal binding and generation-checks transitions", () => {
    expect(normalized).toContain("v_attempt.attempt_id <> p_attempt_id");
    expect(normalized).toContain("v_attempt.generation <> p_generation");
    expect(normalized).toContain("v_attempt.lease_token <> p_lease_token");
    expect(normalized).toContain("v_attempt.lease_expires_at <= v_now");
    expect(normalized).toContain("v_attempt.stripe_customer_id <> p_stripe_customer_id");
    expect(normalized).toContain("v_attempt.stripe_expires_at <> p_stripe_expires_at");
    expect(normalized).toContain(
      "p_session_state not in ('open', 'completed', 'expired')",
    );
    expect(normalized).toContain("('bound_' || p_session_state)::text");
    expect(normalized).toContain(
      "p_target_state not in ('completed', 'expired', 'blocked')",
    );
    const transitionSection = normalized.match(
      /create function public\.transition_subscription_checkout_attempt[\s\S]+?\$\$;/,
    )?.[0] ?? "";
    expect(transitionSection).toContain(
      "elsif v_attempt.state = 'creating' then if p_lease_token is null or v_attempt.lease_token <> p_lease_token or v_attempt.lease_expires_at <= v_now or v_attempt.stripe_checkout_session_id is not null then",
    );
  });

  it("restricts all security-definer RPC execution to service_role", () => {
    const functions = [
      "claim_subscription_checkout_attempt",
      "bind_subscription_checkout_session",
      "transition_subscription_checkout_attempt",
      "resolve_blocked_subscription_checkout_attempt",
    ];
    for (const name of functions) {
      const declaration = new RegExp(
        `create function public\\.${name}\\([\\s\\S]+?security definer set search_path = ''`,
      );
      expect(normalized).toMatch(declaration);
      expect(normalized).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\([\\s\\S]+?from public, anon, authenticated`),
      );
      expect(normalized).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\([\\s\\S]+?to service_role`),
      );
    }
    expect(normalized).not.toMatch(/grant execute[^;]+to (?:public|anon|authenticated)/);
  });

  it("makes blocked recovery exact, terminal-only, and browser-inaccessible", () => {
    expect(normalized).toContain(
      "create function public.resolve_blocked_subscription_checkout_attempt",
    );
    expect(normalized).toContain("v_attempt.state <> 'blocked'");
    expect(normalized).toContain("v_attempt.attempt_id <> p_attempt_id");
    expect(normalized).toContain("v_attempt.generation <> p_generation");
    expect(normalized).toContain(
      "v_attempt.stripe_checkout_session_id is distinct from p_expected_stripe_checkout_session_id",
    );
    expect(normalized).toContain(
      "p_expected_stripe_checkout_session_id is null and p_resolution_state <> 'expired'",
    );
    expect(normalized).toContain("return query select 'resolved'::text");
    const recoverySection = normalized.match(
      /create function public\.resolve_blocked_subscription_checkout_attempt[\s\S]+?\$\$;/,
    )?.[0] ?? "";
    expect(recoverySection).toContain("where user_id = p_user_id for update");
    expect(recoverySection).not.toContain("stripe_checkout_session_id =");
    expect(recoverySection).not.toContain("stripe_expires_at =");
    expect(recoverySection).not.toContain("attempt_id =");
    expect(recoverySection).not.toContain("generation =");
    expect(normalized).toContain(
      "p_expected_stripe_checkout_session_id is null and p_resolution_state <> 'expired'",
    );
  });

  it("does not add a redundant customer-state index", () => {
    expect(normalized).not.toContain(
      "subscription_checkout_attempts_customer_state_idx",
    );
    expect(normalized).not.toContain(
      "on public.subscription_checkout_attempts (stripe_customer_id, state)",
    );
  });

  it("contains no browser policy or change to an existing application table", () => {
    expect(normalized).not.toContain("public.profiles");
    expect(normalized).not.toContain("public.entitlements");
    expect(normalized).not.toContain("public.story_submissions");
    expect(normalized).not.toContain("checkout.sessions.list");
  });
});

describe("application source exclusions", () => {
  const checkoutSource = readFileSync(resolve("api/checkout.ts"), "utf8");
  const apiSource = [
    checkoutSource,
    readFileSync(resolve("api/_checkoutAttempt.ts"), "utf8"),
    readFileSync(resolve("api/stripe-webhook.ts"), "utf8"),
  ].join("\n");

  it("contains no Checkout Session list or legacy discovery", () => {
    expect(apiSource).not.toContain("checkout.sessions.list");
    expect(apiSource).not.toContain("sessions.search");
    expect(apiSource).not.toContain("resolve_blocked_subscription_checkout_attempt");
  });

  it("contains no ten-minute Checkout idempotency bucket", () => {
    expect(checkoutSource).not.toContain("CHECKOUT_IDEMPOTENCY_WINDOW_MS");
    expect(checkoutSource).not.toContain("10 * 60 * 1000");
    expect(checkoutSource).not.toContain("subscription-checkout:v1");
    expect(checkoutSource).toContain("checkoutAttemptIdempotencyKey(attempt.attemptId)");
    expect(checkoutSource).toContain("expires_at: attempt.stripeExpiresAt");
    expect(checkoutSource).not.toMatch(
      /expires_at:\s*Math\.floor\(Date\.now\(\)\s*\/\s*1000\)/,
    );
  });
});
