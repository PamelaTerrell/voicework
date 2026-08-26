import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  attemptLookup: vi.fn(),
  retrieveSession: vi.fn(),
  expireSession: vi.fn(),
}));

vi.mock("../api/_lib.js", () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: mocks.retrieveSession,
        expire: mocks.expireSession,
      },
    },
  },
  supabaseAdmin: {
    rpc: mocks.rpc,
    from: () => ({
      select: () => {
        const filters: Record<string, unknown> = {};
        const query = {
          eq: (column: string, value: unknown) => {
            filters[column] = value;
            return query;
          },
          maybeSingle: () => mocks.attemptLookup(filters),
        };
        return query;
      },
    }),
  },
}));

import {
  bindCheckoutAttempt,
  checkoutAttemptIdempotencyKey,
  claimCheckoutAttempt,
  getCheckoutAttemptForUser,
  inspectOwnedCheckoutSession,
  invalidateOwnedOpenAttemptForUser,
  transitionAttemptFromVerifiedSession,
  transitionCheckoutAttempt,
  type CheckoutAttempt,
} from "../api/_checkoutAttempt.js";

const ids = {
  attempt: "10000000-0000-4000-8000-000000000001",
  lease: "20000000-0000-4000-8000-000000000001",
  session: "cs_test_1234567890abcdef",
};

const expiresAt = 2_000_000_000;

function databaseAttempt(overrides: Record<string, unknown> = {}) {
  return {
    user_id: "user-current",
    attempt_id: ids.attempt,
    generation: 1,
    state: "open",
    stripe_customer_id: "customer-linked",
    stripe_checkout_session_id: ids.session,
    stripe_price_id: "price-server",
    success_url: "https://site.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://site.invalid/listen?canceled=1",
    stripe_expires_at: expiresAt,
    ...overrides,
  };
}

function attempt(overrides: Partial<CheckoutAttempt> = {}): CheckoutAttempt {
  return {
    userId: "user-current",
    attemptId: ids.attempt,
    generation: 1,
    state: "open",
    customerId: "customer-linked",
    sessionId: ids.session,
    priceId: "price-server",
    successUrl: "https://site.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
    cancelUrl: "https://site.invalid/listen?canceled=1",
    stripeExpiresAt: expiresAt,
    ...overrides,
  };
}

function stripeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.session,
    mode: "subscription",
    status: "open",
    customer: "customer-linked",
    client_reference_id: "user-current",
    metadata: { userId: "user-current", purchaseType: "subscription" },
    success_url: "https://site.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://site.invalid/listen?canceled=1",
    expires_at: expiresAt,
    url: "https://checkout.stripe.com/c/pay/isolated",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.attemptLookup.mockReset();
  mocks.retrieveSession.mockReset();
  mocks.expireSession.mockReset();
  mocks.attemptLookup.mockResolvedValue({ data: databaseAttempt(), error: null });
  mocks.retrieveSession.mockResolvedValue(stripeSession());
  mocks.expireSession.mockResolvedValue(
    stripeSession({ status: "expired", url: null }),
  );
  mocks.rpc.mockResolvedValue({ data: [{ outcome: "transitioned" }], error: null });
});

describe("durable checkout attempt RPC validation", () => {
  it.each(["new", "reclaimed", "rotated"] as const)(
    "strictly accepts one server-owned %s claim",
    async (outcome) => {
    mocks.rpc.mockResolvedValue({
      data: [{
        outcome,
        attempt_id: ids.attempt,
        generation: 1,
        lease_token: ids.lease,
        stripe_checkout_session_id: null,
        stripe_customer_id: "customer-linked",
        stripe_price_id: "price-server",
        success_url: "https://site.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://site.invalid/listen?canceled=1",
        stripe_expires_at: expiresAt,
      }],
      error: null,
    });

    const result = await claimCheckoutAttempt({
      userId: "user-current",
      customerId: "customer-linked",
      priceId: "price-server",
      successUrl: "https://site.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://site.invalid/listen?canceled=1",
    });
    expect(result).toMatchObject({
      outcome,
      attemptId: ids.attempt,
      leaseToken: ids.lease,
      stripeExpiresAt: expiresAt,
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "claim_subscription_checkout_attempt",
      expect.objectContaining({ p_user_id: "user-current" }),
    );
    },
  );

  it.each([
    { data: null, error: null },
    { data: [], error: null },
    { data: [{ outcome: "new" }, { outcome: "new" }], error: null },
    { data: [{ outcome: "invented" }], error: null },
    { data: null, error: new Error("database unavailable") },
  ])("rejects malformed, ambiguous, or unavailable claim result %#", async (result) => {
    mocks.rpc.mockResolvedValue(result);
    await expect(claimCheckoutAttempt({
      userId: "user-current",
      customerId: "customer-linked",
      priceId: "price-server",
      successUrl: "https://site.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://site.invalid/listen?canceled=1",
    })).rejects.toThrow("checkout attempt unavailable");
  });

  it("preserves the attempt-specific key across a stale-lease reclaim", async () => {
    const claims = [
      { outcome: "new", leaseToken: ids.lease },
      { outcome: "reclaimed", leaseToken: "30000000-0000-4000-8000-000000000001" },
    ] as const;
    for (const claim of claims) {
      mocks.rpc.mockResolvedValueOnce({
        data: [{
          outcome: claim.outcome,
          attempt_id: ids.attempt,
          generation: 4,
          lease_token: claim.leaseToken,
          stripe_checkout_session_id: null,
          stripe_customer_id: "customer-linked",
          stripe_price_id: "price-server",
          success_url: "https://site.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
          cancel_url: "https://site.invalid/listen?canceled=1",
          stripe_expires_at: expiresAt,
        }],
        error: null,
      });
    }
    const args = {
      userId: "user-current",
      customerId: "customer-linked",
      priceId: "price-server",
      successUrl: "https://site.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://site.invalid/listen?canceled=1",
    };
    const first = await claimCheckoutAttempt(args);
    const second = await claimCheckoutAttempt(args);
    expect(first.outcome).toBe("new");
    expect(second.outcome).toBe("reclaimed");
    if (first.outcome === "busy" || first.outcome === "blocked" || first.outcome === "open") return;
    if (second.outcome === "busy" || second.outcome === "blocked" || second.outcome === "open") return;
    expect(first.attemptId).toBe(second.attemptId);
    expect(first.generation).toBe(second.generation);
    expect(first.priceId).toBe(second.priceId);
    expect(first.successUrl).toBe(second.successUrl);
    expect(first.cancelUrl).toBe(second.cancelUrl);
    expect(first.customerId).toBe(second.customerId);
    expect(first.stripeExpiresAt).toBe(second.stripeExpiresAt);
    expect(first.leaseToken).not.toBe(second.leaseToken);
    expect(checkoutAttemptIdempotencyKey(first.attemptId)).toBe(
      checkoutAttemptIdempotencyKey(second.attemptId),
    );
  });

  it("reuses stored server parameters when configuration changes during recovery", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        outcome: "reclaimed",
        attempt_id: ids.attempt,
        generation: 7,
        lease_token: ids.lease,
        stripe_checkout_session_id: null,
        stripe_customer_id: "customer-linked",
        stripe_price_id: "price-original-server",
        success_url: "https://original.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://original.invalid/listen?canceled=1",
        stripe_expires_at: expiresAt,
      }],
      error: null,
    });
    const result = await claimCheckoutAttempt({
      userId: "user-current",
      customerId: "customer-linked",
      priceId: "price-new-server",
      successUrl: "https://new.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://new.invalid/listen?canceled=1",
    });
    expect(result).toMatchObject({
      outcome: "reclaimed",
      priceId: "price-original-server",
      successUrl: "https://original.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://original.invalid/listen?canceled=1",
    });
  });

  it("requires an exact lease-checked binding response", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{
        outcome: "bound_open",
        stripe_checkout_session_id: ids.session,
        stripe_expires_at: expiresAt,
      }],
      error: null,
    });
    expect(await bindCheckoutAttempt({
      attempt: attempt({ state: "creating", sessionId: null }),
      leaseToken: ids.lease,
      sessionId: ids.session,
      expiresAt,
      state: "open",
    })).toEqual({ outcome: "bound_open", state: "open" });

    mocks.rpc.mockResolvedValueOnce({ data: [{ outcome: "stale" }], error: null });
    expect(await bindCheckoutAttempt({
      attempt: attempt({ state: "creating", sessionId: null }),
      leaseToken: ids.lease,
      sessionId: ids.session,
      expiresAt,
      state: "open",
    })).toBeNull();
  });

  it.each(["open", "completed", "expired"] as const)(
    "binds %s only after an exact lease-checked response",
    async (state) => {
      mocks.rpc.mockResolvedValueOnce({
        data: [{
          outcome: `bound_${state}`,
          stripe_checkout_session_id: ids.session,
          stripe_expires_at: expiresAt,
        }],
        error: null,
      });
      expect(await bindCheckoutAttempt({
        attempt: attempt({ state: "creating", sessionId: null }),
        leaseToken: ids.lease,
        sessionId: ids.session,
        expiresAt,
        state,
      })).toEqual({ outcome: `bound_${state}`, state });
      expect(mocks.rpc).toHaveBeenLastCalledWith(
        "bind_subscription_checkout_session",
        expect.objectContaining({
          p_stripe_customer_id: "customer-linked",
          p_stripe_expires_at: expiresAt,
          p_session_state: state,
        }),
      );
    },
  );

  it.each(["open", "completed", "expired"] as const)(
    "rejects a stale-token response for %s binding",
    async (state) => {
      mocks.rpc.mockResolvedValueOnce({
        data: [{ outcome: "stale" }],
        error: null,
      });
      expect(await bindCheckoutAttempt({
        attempt: attempt({ state: "creating", sessionId: null }),
        leaseToken: ids.lease,
        sessionId: ids.session,
        expiresAt,
        state,
      })).toBeNull();
    },
  );

  it("rejects a bind when the Session expiration differs from storage", async () => {
    expect(await bindCheckoutAttempt({
      attempt: attempt({ state: "creating", sessionId: null }),
      leaseToken: ids.lease,
      sessionId: ids.session,
      expiresAt: expiresAt + 1,
      state: "open",
    })).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("owned Stripe Checkout Session validation", () => {
  it("accepts only an exact future Stripe-hosted open Session", () => {
    expect(inspectOwnedCheckoutSession(stripeSession() as never, attempt(), 1_900_000_000))
      .toEqual({
        state: "open",
        url: "https://checkout.stripe.com/c/pay/isolated",
        expiresAt,
      });
  });

  it.each([
    { id: "cs_test_0000000000wrong" },
    { customer: "customer-other" },
    { client_reference_id: "user-other" },
    { metadata: { userId: "user-other", purchaseType: "subscription" } },
    { mode: "payment" },
    { url: "http://checkout.stripe.com/insecure" },
    { url: "https://attacker.invalid/path" },
    { expires_at: expiresAt + 1 },
    { expires_at: 1_800_000_000 },
  ])("rejects mismatched or malformed owned Session %#", (overrides) => {
    expect(inspectOwnedCheckoutSession(
      stripeSession(overrides) as never,
      attempt(),
      1_900_000_000,
    )).toBeNull();
  });

  it("retrieves and expires only the exact stored open Session", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ outcome: "transitioned" }], error: null });
    await invalidateOwnedOpenAttemptForUser("user-current", "customer-linked");
    expect(mocks.retrieveSession).toHaveBeenCalledWith(ids.session);
    expect(mocks.expireSession).toHaveBeenCalledWith(ids.session);
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "transition_subscription_checkout_attempt",
      expect.objectContaining({
        p_user_id: "user-current",
        p_attempt_id: ids.attempt,
        p_generation: 1,
        p_stripe_checkout_session_id: ids.session,
        p_target_state: "expired",
      }),
    );
  });

  it("does not transition an old Session event against a newer generation", async () => {
    await transitionAttemptFromVerifiedSession(
      "user-current",
      stripeSession({ id: "cs_test_0000000000older", status: "complete" }) as never,
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("accepts an idempotent transition replay and exposes no provider detail", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ outcome: "noop" }], error: null });
    expect(await transitionCheckoutAttempt({
      attempt: attempt(),
      targetState: "expired",
    })).toBe("noop");

    mocks.attemptLookup.mockResolvedValue({
      data: null,
      error: new Error("customer-sensitive provider detail"),
    });
    await expect(getCheckoutAttemptForUser("user-current"))
      .rejects.toThrow("checkout attempt unavailable");
  });

  it("accepts the explicitly resolved unbound expired representation", async () => {
    mocks.attemptLookup.mockResolvedValue({
      data: databaseAttempt({
        state: "expired",
        stripe_checkout_session_id: null,
      }),
      error: null,
    });
    await expect(getCheckoutAttemptForUser("user-current")).resolves.toMatchObject({
      state: "expired",
      sessionId: null,
      stripeExpiresAt: expiresAt,
    });
  });
});
