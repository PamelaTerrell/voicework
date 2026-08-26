import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { authError, request, response } from "./helpers.js";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  reconcileMembership: vi.fn(),
  profileResult: { data: null as unknown, error: null as unknown },
  profileEq: vi.fn(),
  profileUpsert: vi.fn(),
  retrieveCustomer: vi.fn(),
  createCustomer: vi.fn(),
  listSubscriptions: vi.fn(),
  createSession: vi.fn(),
  claimAttempt: vi.fn(),
  bindAttempt: vi.fn(),
  retrieveOwnedSession: vi.fn(),
  transitionAttempt: vi.fn(),
  invalidateOwnedAttempt: vi.fn(),
  inspectOwnedSession: vi.fn(),
}));

const attempt = (overrides: Record<string, unknown> = {}) => ({
  outcome: "new",
  userId: "user-current",
  attemptId: "10000000-0000-4000-8000-000000000001",
  generation: 1,
  state: "creating",
  customerId: "customer-linked",
  sessionId: null,
  priceId: "price_subscription_server",
  successUrl: "https://site.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
  cancelUrl: "https://site.invalid/listen?canceled=1",
  stripeExpiresAt: 2_000_000_000,
  leaseToken: "20000000-0000-4000-8000-000000000001",
  ...overrides,
});

vi.mock("../api/_membership.js", () => ({
  reconcileAuthenticatedMembership: mocks.reconcileMembership,
}));

vi.mock("../api/_checkoutAttempt.js", () => ({
  claimCheckoutAttempt: mocks.claimAttempt,
  bindCheckoutAttempt: mocks.bindAttempt,
  retrieveOwnedCheckoutSession: mocks.retrieveOwnedSession,
  transitionCheckoutAttempt: mocks.transitionAttempt,
  invalidateOwnedOpenAttemptForUser: mocks.invalidateOwnedAttempt,
  inspectOwnedCheckoutSession: mocks.inspectOwnedSession,
  checkoutAttemptIdempotencyKey: (attemptId: string) =>
    `night-listener:subscription-checkout:v2:${attemptId}`,
}));

vi.mock("../api/_lib.js", () => ({
  normalizeEmail: (value?: string | null) => value?.trim().toLowerCase() ?? null,
  requireUser: mocks.requireUser,
  stripe: {
    customers: {
      retrieve: mocks.retrieveCustomer,
      create: mocks.createCustomer,
    },
    subscriptions: { list: mocks.listSubscriptions },
    checkout: { sessions: { create: mocks.createSession } },
  },
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: mocks.profileEq.mockImplementation(() => ({
          maybeSingle: async () => mocks.profileResult,
        })),
      }),
      upsert: mocks.profileUpsert,
    }),
  },
}));

import checkout from "../api/checkout.js";

beforeEach(() => {
  vi.useRealTimers();
  process.env.STRIPE_PRICE_ID_SUBSCRIPTION = "price_subscription_server";
  process.env.SITE_URL = "https://site.invalid";
  mocks.requireUser.mockResolvedValue({ id: "user-current", email: "trusted" });
  mocks.reconcileMembership.mockResolvedValue({
    outcome: "inactive",
    active: false,
    cancellationScheduled: false,
    cancellationEffectiveAt: null,
    customerId: "customer-linked",
  });
  mocks.profileResult = {
    data: { id: "user-current", stripe_customer_id: "customer-linked" },
    error: null,
  };
  mocks.retrieveCustomer.mockResolvedValue({ id: "customer-linked", email: "trusted" });
  mocks.createCustomer.mockResolvedValue({ id: "customer-created" });
  mocks.listSubscriptions.mockResolvedValue({ data: [], has_more: false });
  mocks.profileUpsert.mockResolvedValue({ error: null });
  mocks.claimAttempt.mockResolvedValue(attempt());
  mocks.bindAttempt.mockResolvedValue({ outcome: "bound_open", state: "open" });
  mocks.transitionAttempt.mockResolvedValue("transitioned");
  mocks.invalidateOwnedAttempt.mockResolvedValue(undefined);
  mocks.createSession.mockImplementation(async (params) => ({
    id: "cs_test_1234567890abcdef",
    mode: "subscription",
    status: "open",
    customer: "customer-linked",
    client_reference_id: "user-current",
    metadata: { userId: "user-current", purchaseType: "subscription" },
    success_url: params.success_url,
    cancel_url: params.cancel_url,
    expires_at: params.expires_at,
    url: "https://checkout.stripe.com/c/pay/isolated",
  }));
  mocks.inspectOwnedSession.mockImplementation((session) => ({
    state: "open",
    url: session.url,
    expiresAt: session.expires_at,
  }));
  mocks.retrieveOwnedSession.mockImplementation(async (candidate) => ({
    session: {},
    inspection: {
      state: "open",
      url: "https://checkout.stripe.com/c/pay/isolated",
      expiresAt: candidate.stripeExpiresAt,
    },
  }));
});

async function call(body: unknown) {
  const output = response();
  await checkout(request({ method: "POST", body }), output.res);
  expect(output.result.headers.get("cache-control")).toBe("no-store");
  expect(output.result.headers.get("vary")).toBe("Authorization");
  return output;
}

it("sets authenticated cache headers before method validation", async () => {
  const output = response();
  output.res.setHeader("Vary", "Accept-Encoding");
  await checkout(request({ method: "GET" }), output.res);
  expect(output.result.statusCode).toBe(405);
  expect(output.result.headers.get("cache-control")).toBe("no-store");
  expect(output.result.headers.get("vary")).toBe("Accept-Encoding, Authorization");
});

describe("authenticated checkout creation", () => {
  it("requires authentication for subscription checkout", async () => {
    mocks.requireUser.mockRejectedValue(authError("Missing Authorization Bearer token"));
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(401);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it.each([
    { mode: "one_time" },
    { mode: "one_time", episodeId: "conversation-ep2" },
    { mode: "subscription", episodeId: "conversation-ep2" },
    { mode: "subscription", unexpected: true },
  ])("rejects one-time or unsupported checkout request %#", async (body) => {
    const { result } = await call(body);
    expect(result.statusCode).toBe(400);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it.each(["userId", "email", "customerId", "priceId", "isSubscriber"])(
    "rejects privileged browser field %s",
    async (field) => {
      const { result } = await call({ mode: "subscription", [field]: "nominated" });
      expect(result.statusCode).toBe(400);
      expect(mocks.createSession).not.toHaveBeenCalled();
    }
  );

  it("creates subscription checkout using only server configuration", async () => {
    delete process.env.STRIPE_PRICE_ID_ONE_TIME;
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(200);
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_subscription_server", quantity: 1 }],
        metadata: { userId: "user-current", purchaseType: "subscription" },
        subscription_data: {
          metadata: { userId: "user-current", purchaseType: "subscription" },
        },
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(mocks.createSession.mock.calls[0][0].expires_at).toBe(2_000_000_000);
  });

  it("contains no one-time price read or payment-mode session creation", () => {
    const source = readFileSync(resolve("api/checkout.ts"), "utf8");
    expect(source).not.toContain("STRIPE_PRICE_ID_ONE_TIME");
    expect(source).not.toContain('mode: "payment"');
    expect(source).not.toContain('purchaseType: "one_time"');
  });

  it("fails closed when trusted reconciliation reports a customer conflict", async () => {
    mocks.reconcileMembership.mockResolvedValue({
      outcome: "conflict",
      active: false,
      cancellationScheduled: false,
      cancellationEffectiveAt: null,
      customerId: null,
    });
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(409);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("fails closed when trusted reconciliation is unavailable", async () => {
    mocks.reconcileMembership.mockResolvedValue({
      outcome: "unavailable",
      active: false,
      cancellationScheduled: false,
      cancellationEffectiveAt: null,
      customerId: null,
    });
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(409);
    expect(mocks.listSubscriptions).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it.each(["busy", "blocked"])(
    "fails closed without Stripe creation for a %s durable attempt",
    async (outcome) => {
      mocks.claimAttempt.mockResolvedValue({ outcome });
      const { result } = await call({ mode: "subscription" });
      expect(result.statusCode).toBe(409);
      expect(Object.keys(result.body as object)).toEqual(["error"]);
      expect(mocks.createSession).not.toHaveBeenCalled();
    },
  );

  it("creates nothing when the durable claim is unavailable", async () => {
    mocks.claimAttempt.mockRejectedValue(new Error("database unavailable"));
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({ error: "Unable to start checkout." });
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it.each([
    ["less than thirty minutes away", 29 * 60 + 59],
    ["already past", -1],
  ])(
    "blocks a reclaimed unbound attempt whose expiration is %s",
    async (_label, expirationOffsetSeconds) => {
      vi.useFakeTimers();
      const nowSeconds = 1_900_000_000;
      vi.setSystemTime(new Date(nowSeconds * 1000));
      const agedAttempt = attempt({
        outcome: "reclaimed",
        stripeExpiresAt: nowSeconds + expirationOffsetSeconds,
        leaseToken: "30000000-0000-4000-8000-000000000001",
      });
      mocks.claimAttempt.mockResolvedValue(agedAttempt);
      mocks.transitionAttempt.mockResolvedValue("transitioned");

      const { result } = await call({ mode: "subscription" });

      expect(result).toEqual({
        statusCode: 409,
        body: { error: "Unable to start checkout safely." },
      });
      expect(Object.keys(result.body as object)).toEqual(["error"]);
      expect(mocks.transitionAttempt).toHaveBeenCalledWith({
        attempt: agedAttempt,
        targetState: "blocked",
        leaseToken: "30000000-0000-4000-8000-000000000001",
      });
      expect(mocks.claimAttempt).toHaveBeenCalledTimes(1);
      expect(mocks.createSession).not.toHaveBeenCalled();
      expect(mocks.retrieveOwnedSession).not.toHaveBeenCalled();
      expect(mocks.inspectOwnedSession).not.toHaveBeenCalled();
      expect(mocks.bindAttempt).not.toHaveBeenCalled();
      expect(mocks.invalidateOwnedAttempt).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["stale", "stale", 409],
    ["unavailable", new Error("database detail"), 500],
  ] as const)(
    "fails generically when the aged-attempt transition is %s",
    async (_label, transitionResult, statusCode) => {
      vi.useFakeTimers();
      const nowSeconds = 1_900_000_000;
      vi.setSystemTime(new Date(nowSeconds * 1000));
      mocks.claimAttempt.mockResolvedValue(attempt({
        outcome: "reclaimed",
        stripeExpiresAt: nowSeconds + 31 * 60,
      }));
      if (transitionResult instanceof Error) {
        mocks.transitionAttempt.mockRejectedValue(transitionResult);
      } else {
        mocks.transitionAttempt.mockResolvedValue(transitionResult);
      }

      const { result } = await call({ mode: "subscription" });

      expect(result.statusCode).toBe(statusCode);
      expect(result.body).toEqual({
        error: statusCode === 409
          ? "Unable to start checkout safely."
          : "Unable to start checkout.",
      });
      expect(mocks.claimAttempt).toHaveBeenCalledTimes(1);
      expect(mocks.createSession).not.toHaveBeenCalled();
      expect(mocks.retrieveOwnedSession).not.toHaveBeenCalled();
      expect(mocks.bindAttempt).not.toHaveBeenCalled();
    },
  );

  it("uses a two-minute buffer above Stripe's thirty-minute minimum", async () => {
    vi.useFakeTimers();
    const nowSeconds = 1_900_000_000;
    vi.setSystemTime(new Date(nowSeconds * 1000));
    mocks.claimAttempt.mockResolvedValueOnce(attempt({
      stripeExpiresAt: nowSeconds + 32 * 60,
    }));
    expect((await call({ mode: "subscription" })).result.statusCode).toBe(409);
    expect(mocks.createSession).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-current", email: "trusted" });
    mocks.reconcileMembership.mockResolvedValue({
      outcome: "inactive",
      active: false,
      cancellationScheduled: false,
      cancellationEffectiveAt: null,
      customerId: "customer-linked",
    });
    mocks.listSubscriptions.mockResolvedValue({ data: [], has_more: false });
    mocks.claimAttempt.mockResolvedValue(attempt({
      stripeExpiresAt: nowSeconds + 32 * 60 + 1,
    }));
    mocks.createSession.mockImplementation(async (params) => ({
      id: "cs_test_1234567890abcdef",
      mode: "subscription",
      status: "open",
      customer: "customer-linked",
      client_reference_id: "user-current",
      metadata: { userId: "user-current", purchaseType: "subscription" },
      success_url: params.success_url,
      cancel_url: params.cancel_url,
      expires_at: params.expires_at,
      url: "https://checkout.stripe.com/c/pay/isolated",
    }));
    mocks.inspectOwnedSession.mockImplementation((session) => ({
      state: "open",
      url: session.url,
      expiresAt: session.expires_at,
    }));
    mocks.retrieveOwnedSession.mockResolvedValue({
      session: {},
      inspection: {
        state: "open",
        url: "https://checkout.stripe.com/c/pay/isolated",
        expiresAt: nowSeconds + 32 * 60 + 1,
      },
    });
    mocks.bindAttempt.mockResolvedValue({ outcome: "bound_open", state: "open" });

    expect((await call({ mode: "subscription" })).result.statusCode).toBe(200);
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
  });

  it.each(["active", "trialing"])(
    "blocks a verified %s subscription with a minimal response",
    async (status) => {
      mocks.listSubscriptions.mockResolvedValue({
        data: [{ customer: "customer-linked", status }],
        has_more: false,
      });

      const { result } = await call({ mode: "subscription" });
      expect(result.statusCode).toBe(409);
      expect(result.body).toEqual({
        error: "An active membership already exists for this account.",
      });
      expect(Object.keys(result.body as object)).toEqual(["error"]);
      expect(mocks.createCustomer).not.toHaveBeenCalled();
      expect(mocks.createSession).not.toHaveBeenCalled();
      expect(mocks.listSubscriptions).toHaveBeenCalledWith({
        customer: "customer-linked",
        status: "all",
        limit: 100,
      });
      expect(mocks.invalidateOwnedAttempt).toHaveBeenCalledWith(
        "user-current",
        "customer-linked",
      );
    },
  );

  it("blocks before customer or Session creation when reconciliation repairs an active member", async () => {
    mocks.reconcileMembership.mockResolvedValue({
      outcome: "active",
      active: true,
      cancellationScheduled: false,
      cancellationEffectiveAt: null,
      customerId: "customer-repaired",
    });
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(409);
    expect(result.body).toEqual({
      error: "An active membership already exists for this account.",
    });
    expect(mocks.createCustomer).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it.each(["canceled", "incomplete_expired"])(
    "allows the conclusively terminal %s status",
    async (status) => {
      mocks.listSubscriptions.mockResolvedValue({
        data: [{ customer: "customer-linked", status }],
        has_more: false,
      });

      const { result } = await call({ mode: "subscription" });
      expect(result.statusCode).toBe(200);
      expect(mocks.createSession).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["past_due", "unpaid", "paused", "incomplete"])(
    "blocks the nonterminal %s status with a minimal attention response",
    async (status) => {
      mocks.listSubscriptions.mockResolvedValue({
        data: [{ customer: "customer-linked", status }],
        has_more: false,
      });

      const { result } = await call({ mode: "subscription" });
      expect(result.statusCode).toBe(409);
      expect(result.body).toEqual({
        error:
          "An existing membership requires attention before starting a new checkout.",
      });
      expect(Object.keys(result.body as object)).toEqual(["error"]);
      expect(mocks.createSession).not.toHaveBeenCalled();
      expect(mocks.invalidateOwnedAttempt).toHaveBeenCalledWith(
        "user-current",
        "customer-linked",
      );
    },
  );

  it("permits checkout when the verified customer has no subscriptions", async () => {
    mocks.listSubscriptions.mockResolvedValue({ data: [], has_more: false });

    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(200);
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
  });

  it.each(["active", "past_due"])(
    "blocks a mixed terminal collection containing %s",
    async (status) => {
      mocks.listSubscriptions.mockResolvedValue({
        data: [
          { customer: "customer-linked", status: "canceled" },
          { customer: "customer-linked", status },
          { customer: "customer-linked", status: "incomplete_expired" },
        ],
        has_more: false,
      });

      const { result } = await call({ mode: "subscription" });
      expect(result.statusCode).toBe(409);
      expect(mocks.createSession).not.toHaveBeenCalled();
    },
  );

  it("retains the active response when a mixed collection also needs attention", async () => {
    mocks.listSubscriptions.mockResolvedValue({
      data: [
        { customer: "customer-linked", status: "past_due" },
        { customer: "customer-linked", status: "active" },
      ],
      has_more: false,
    });

    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(409);
    expect(result.body).toEqual({
      error: "An active membership already exists for this account.",
    });
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("allows a collection only when every subscription is terminal", async () => {
    mocks.listSubscriptions.mockResolvedValue({
      data: [
        { customer: "customer-linked", status: "canceled" },
        { customer: "customer-linked", status: "incomplete_expired" },
      ],
      has_more: false,
    });

    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(200);
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["pagination", { data: [], has_more: true }],
    [
      "ownership mismatch",
      {
        data: [{ customer: "customer-other", status: "canceled" }],
        has_more: false,
      },
    ],
    [
      "unfamiliar status",
      {
        data: [{ customer: "customer-linked", status: "provider-new-status" }],
        has_more: false,
      },
    ],
    ["malformed collection", { data: null, has_more: false }],
  ])("fails closed for %s", async (_label, providerResult) => {
    mocks.listSubscriptions.mockResolvedValue(providerResult);
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(409);
    expect(result.body).toEqual({ error: "Unable to start checkout safely." });
    expect(mocks.createCustomer).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("permits at most one Session creation across concurrent equivalent requests", async () => {
    mocks.claimAttempt
      .mockResolvedValueOnce(attempt())
      .mockResolvedValueOnce({ outcome: "busy" });
    await Promise.all([
      call({ mode: "subscription" }),
      call({ mode: "subscription" }),
    ]);

    const keys = mocks.createSession.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys).toEqual([
      "night-listener:subscription-checkout:v2:10000000-0000-4000-8000-000000000001",
    ]);
  });

  it("uses different Checkout idempotency keys for different authenticated users", async () => {
    mocks.requireUser
      .mockResolvedValueOnce({ id: "trusted-user-a", email: "trusted" })
      .mockResolvedValueOnce({ id: "trusted-user-b", email: "trusted" });
    mocks.claimAttempt
      .mockResolvedValueOnce(attempt({
        userId: "trusted-user-a",
        attemptId: "10000000-0000-4000-8000-00000000000a",
      }))
      .mockResolvedValueOnce(attempt({
        userId: "trusted-user-b",
        attemptId: "10000000-0000-4000-8000-00000000000b",
      }));

    await call({ mode: "subscription" });
    await call({ mode: "subscription" });

    const keys = mocks.createSession.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("reuses one durable open attempt across ten-minute boundaries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const openAttempt = attempt({
      outcome: "open",
      state: "open",
      sessionId: "cs_test_1234567890abcdef",
      stripeExpiresAt: 1767227460,
      leaseToken: undefined,
    });
    mocks.claimAttempt
      .mockResolvedValueOnce(attempt())
      .mockResolvedValueOnce(openAttempt);
    mocks.retrieveOwnedSession.mockResolvedValue({
      session: {},
      inspection: {
        state: "open",
        url: "https://checkout.stripe.com/c/pay/isolated",
        expiresAt: 1767227460,
      },
    });
    await call({ mode: "subscription" });
    vi.advanceTimersByTime(10 * 60 * 1000);
    await call({ mode: "subscription" });

    expect(mocks.createSession).toHaveBeenCalledTimes(1);
    expect(mocks.retrieveOwnedSession).toHaveBeenCalledWith(openAttempt);
  });

  it("waits for a later eligibility-checked request after an open Session expires", async () => {
    const expiredAttempt = attempt({
      outcome: "open",
      state: "open",
      sessionId: "cs_test_1234567890expired",
      stripeExpiresAt: 1767225000,
      leaseToken: undefined,
    });
    mocks.claimAttempt
      .mockResolvedValueOnce(expiredAttempt)
      .mockResolvedValueOnce(attempt({
        outcome: "rotated",
        attemptId: "10000000-0000-4000-8000-000000000002",
        generation: 2,
        stripeExpiresAt: 2_000_002_100,
      }));
    mocks.retrieveOwnedSession
      .mockResolvedValueOnce({
        session: {},
        inspection: { state: "expired", expiresAt: 1767225000 },
      })
      .mockResolvedValueOnce({
        session: {},
        inspection: {
          state: "open",
          url: "https://checkout.stripe.com/c/pay/new-generation",
          expiresAt: 2_000_002_100,
        },
      });

    expect((await call({ mode: "subscription" })).result.statusCode).toBe(409);
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect((await call({ mode: "subscription" })).result.statusCode).toBe(200);
    expect(mocks.transitionAttempt).toHaveBeenCalledWith({
      attempt: expiredAttempt,
      targetState: "expired",
    });
    expect(mocks.claimAttempt).toHaveBeenCalledTimes(2);
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
    expect(mocks.reconcileMembership).toHaveBeenCalledTimes(2);
    expect(mocks.reconcileMembership.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.claimAttempt.mock.invocationCallOrder[1],
    );
    expect(mocks.createSession.mock.calls[0][0].expires_at).toBe(2_000_002_100);
    expect(mocks.createSession.mock.calls[0][0].expires_at).toBeGreaterThan(
      expiredAttempt.stripeExpiresAt,
    );
  });

  it("does not replace a stored Session that Stripe reports complete", async () => {
    const completedAttempt = attempt({
      outcome: "open",
      state: "open",
      sessionId: "cs_test_1234567890complete",
      stripeExpiresAt: 1767225000,
      leaseToken: undefined,
    });
    mocks.claimAttempt.mockResolvedValue(completedAttempt);
    mocks.retrieveOwnedSession.mockResolvedValue({
      session: {},
      inspection: { state: "completed", expiresAt: 1767225000 },
    });
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(409);
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.claimAttempt).toHaveBeenCalledTimes(1);
  });

  it("returns no URL when Stripe succeeds but lease-checked binding fails", async () => {
    mocks.bindAttempt.mockResolvedValue(null);
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({ error: "Unable to start checkout." });
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
  });

  it("returns no URL or bind when Stripe expiration differs from storage", async () => {
    mocks.inspectOwnedSession.mockReturnValue(null);
    const { result } = await call({ mode: "subscription" });
    expect(result).toEqual({
      statusCode: 500,
      body: { error: "Unable to start checkout." },
    });
    expect(mocks.retrieveOwnedSession).not.toHaveBeenCalled();
    expect(mocks.bindAttempt).not.toHaveBeenCalled();
  });

  it("replays byte-identical Stripe creation after a lost bind and stale-lease reclaim", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const firstAttempt = attempt({ outcome: "new" });
    const reclaimedAttempt = attempt({
      outcome: "reclaimed",
      leaseToken: "30000000-0000-4000-8000-000000000001",
    });
    mocks.claimAttempt
      .mockResolvedValueOnce(firstAttempt)
      .mockResolvedValueOnce(reclaimedAttempt);
    mocks.bindAttempt
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ outcome: "bound_open", state: "open" });
    let firstCreation: unknown;
    mocks.createSession.mockImplementation(async (params, options) => {
      const creation = { params, options };
      if (!firstCreation) firstCreation = structuredClone(creation);
      else expect(creation).toEqual(firstCreation);
      return {
        id: "cs_test_1234567890abcdef",
        mode: "subscription",
        status: "open",
        customer: "customer-linked",
        client_reference_id: "user-current",
        metadata: { userId: "user-current", purchaseType: "subscription" },
        success_url: params.success_url,
        cancel_url: params.cancel_url,
        expires_at: params.expires_at,
        url: "https://checkout.stripe.com/c/pay/isolated",
      };
    });
    expect((await call({ mode: "subscription" })).result.statusCode).toBe(500);
    vi.advanceTimersByTime(2 * 60 * 1000 + 1);
    expect((await call({ mode: "subscription" })).result.statusCode).toBe(200);
    const keys = mocks.createSession.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys).toEqual([
      "night-listener:subscription-checkout:v2:10000000-0000-4000-8000-000000000001",
      "night-listener:subscription-checkout:v2:10000000-0000-4000-8000-000000000001",
    ]);
    expect(mocks.createSession.mock.calls[0][0]).toEqual(
      mocks.createSession.mock.calls[1][0],
    );
    expect(firstAttempt.stripeExpiresAt).toBe(reclaimedAttempt.stripeExpiresAt);
  });

  it.each(["expired", "completed"] as const)(
    "terminally binds a Session that becomes %s before binding and returns no URL",
    async (state) => {
      mocks.inspectOwnedSession.mockReturnValue({
        state,
        expiresAt: 2_000_000_000,
      });
      mocks.retrieveOwnedSession.mockResolvedValue({
        session: {},
        inspection: { state, expiresAt: 2_000_000_000 },
      });
      mocks.bindAttempt.mockResolvedValue({
        outcome: `bound_${state}`,
        state,
      });

      const { result } = await call({ mode: "subscription" });
      expect(result.statusCode).toBe(409);
      expect(result.body).toEqual({
        error: state === "completed"
          ? "An existing checkout has already been completed."
          : "The previous checkout has expired. Please try again.",
      });
      expect(mocks.bindAttempt).toHaveBeenCalledWith(expect.objectContaining({
        expiresAt: 2_000_000_000,
        state,
      }));
      expect(mocks.claimAttempt).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["expired", "completed"] as const)(
    "replays identical creation and binds %s after a lost response window",
    async (terminalState) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      mocks.claimAttempt
        .mockResolvedValueOnce(attempt({ outcome: "new" }))
        .mockResolvedValueOnce(attempt({
          outcome: "reclaimed",
          leaseToken: "30000000-0000-4000-8000-000000000001",
        }));
      mocks.bindAttempt
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          outcome: `bound_${terminalState}`,
          state: terminalState,
        });

      let firstCreation: unknown;
      let createCount = 0;
      mocks.createSession.mockImplementation(async (params, options) => {
        const creation = { params, options };
        if (!firstCreation) firstCreation = structuredClone(creation);
        else expect(creation).toEqual(firstCreation);
        createCount += 1;
        return {
          id: "cs_test_1234567890abcdef",
          mode: "subscription",
          status: createCount === 1
            ? "open"
            : terminalState === "completed" ? "complete" : "expired",
          customer: "customer-linked",
          client_reference_id: "user-current",
          metadata: { userId: "user-current", purchaseType: "subscription" },
          success_url: params.success_url,
          cancel_url: params.cancel_url,
          expires_at: params.expires_at,
          url: createCount === 1
            ? "https://checkout.stripe.com/c/pay/isolated"
            : null,
        };
      });
      mocks.inspectOwnedSession.mockImplementation((session) => ({
        state: session.status === "open" ? "open" : terminalState,
        ...(session.status === "open" ? { url: session.url } : {}),
        expiresAt: session.expires_at,
      }));
      mocks.retrieveOwnedSession
        .mockResolvedValueOnce({
          session: {},
          inspection: {
            state: "open",
            url: "https://checkout.stripe.com/c/pay/isolated",
            expiresAt: 2_000_000_000,
          },
        })
        .mockResolvedValueOnce({
          session: {},
          inspection: { state: terminalState, expiresAt: 2_000_000_000 },
        });

      expect((await call({ mode: "subscription" })).result.statusCode).toBe(500);
      vi.advanceTimersByTime(2 * 60 * 1000 + 1);
      const second = await call({ mode: "subscription" });
      expect(second.result.statusCode).toBe(409);
      expect(mocks.createSession.mock.calls[0]).toEqual(
        mocks.createSession.mock.calls[1],
      );
      expect(mocks.bindAttempt).toHaveBeenLastCalledWith(expect.objectContaining({
        state: terminalState,
        expiresAt: 2_000_000_000,
      }));
    },
  );

  it("rotates nothing when Stripe creation is unavailable", async () => {
    mocks.createSession.mockRejectedValue(new Error("provider unavailable"));
    await call({ mode: "subscription" });
    await call({ mode: "subscription" });
    expect(mocks.claimAttempt.mock.calls).toHaveLength(2);
    expect(mocks.claimAttempt.mock.results).toHaveLength(2);
    expect(mocks.bindAttempt).not.toHaveBeenCalled();
    expect(mocks.transitionAttempt).not.toHaveBeenCalled();
  });

  it("uses safe request-option keys for customer and Checkout creation", async () => {
    const sensitiveValues = [
      "trusted-email-sensitive",
      "browser-nominated",
      "bearer-token-sensitive",
      "secret-sensitive",
      "price_subscription_server",
    ];
    mocks.requireUser.mockResolvedValue({
      id: "trusted-user-for-key",
      email: "trusted-email-sensitive",
    });
    mocks.profileResult = { data: null, error: null };
    mocks.reconcileMembership.mockResolvedValue({
      outcome: "inactive",
      active: false,
      cancellationScheduled: false,
      cancellationEffectiveAt: null,
      customerId: null,
    });

    await call({ mode: "subscription" });

    expect(mocks.createCustomer).toHaveBeenCalledWith(
      {
        email: "trusted-email-sensitive",
        metadata: { userId: "trusted-user-for-key" },
      },
      { idempotencyKey: expect.any(String) },
    );
    const customerKey = mocks.createCustomer.mock.calls[0][1].idempotencyKey;
    const checkoutKey = mocks.createSession.mock.calls[0][1].idempotencyKey;
    expect(customerKey.length).toBeLessThanOrEqual(255);
    expect(checkoutKey.length).toBeLessThanOrEqual(255);
    for (const key of [customerKey, checkoutKey]) {
      for (const sensitive of sensitiveValues) expect(key).not.toContain(sensitive);
    }
    expect(mocks.createSession.mock.calls[0][0]).not.toHaveProperty(
      "idempotencyKey",
    );
  });

  it("reuses the customer-creation key for concurrent trusted-user requests", async () => {
    mocks.profileResult = { data: null, error: null };
    mocks.reconcileMembership.mockResolvedValue({
      outcome: "inactive",
      active: false,
      cancellationScheduled: false,
      cancellationEffectiveAt: null,
      customerId: null,
    });
    await Promise.all([
      call({ mode: "subscription" }),
      call({ mode: "subscription" }),
    ]);
    const keys = mocks.createCustomer.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(1);
  });

  it("returns generic failure without raw Stripe identifiers", async () => {
    mocks.createSession.mockRejectedValue(new Error("customer-sensitive raw failure"));
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({ error: "Unable to start checkout." });
  });
});
