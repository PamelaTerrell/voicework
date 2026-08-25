import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { authError, request, response } from "./helpers.js";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  profileResult: { data: null as unknown, error: null as unknown },
  profileEq: vi.fn(),
  profileUpsert: vi.fn(),
  retrieveCustomer: vi.fn(),
  createCustomer: vi.fn(),
  listSubscriptions: vi.fn(),
  createSession: vi.fn(),
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
  mocks.profileResult = {
    data: { id: "user-current", stripe_customer_id: "customer-linked" },
    error: null,
  };
  mocks.retrieveCustomer.mockResolvedValue({ email: "trusted" });
  mocks.createCustomer.mockResolvedValue({ id: "customer-created" });
  mocks.listSubscriptions.mockResolvedValue({ data: [], has_more: false });
  mocks.profileUpsert.mockResolvedValue({ error: null });
  mocks.createSession.mockResolvedValue({ url: "https://checkout.invalid/path" });
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
  });

  it("contains no one-time price read or payment-mode session creation", () => {
    const source = readFileSync(resolve("api/checkout.ts"), "utf8");
    expect(source).not.toContain("STRIPE_PRICE_ID_ONE_TIME");
    expect(source).not.toContain('mode: "payment"');
    expect(source).not.toContain('purchaseType: "one_time"');
  });

  it("rejects a mismatched stored customer identity", async () => {
    mocks.retrieveCustomer.mockResolvedValue({ email: "different" });
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(400);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects a deleted stored customer before subscription lookup", async () => {
    mocks.retrieveCustomer.mockResolvedValue({ deleted: true });
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(400);
    expect(mocks.listSubscriptions).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
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
    },
  );

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

  it("uses the same safe Checkout idempotency key for concurrent equivalent requests", async () => {
    await Promise.all([
      call({ mode: "subscription" }),
      call({ mode: "subscription" }),
    ]);

    const keys = mocks.createSession.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(1);
  });

  it("uses different Checkout idempotency keys for different authenticated users", async () => {
    mocks.requireUser
      .mockResolvedValueOnce({ id: "trusted-user-a", email: "trusted" })
      .mockResolvedValueOnce({ id: "trusted-user-b", email: "trusted" });

    await call({ mode: "subscription" });
    await call({ mode: "subscription" });

    const keys = mocks.createSession.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("permits a deliberate Checkout retry in a later ten-minute window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await call({ mode: "subscription" });
    vi.advanceTimersByTime(10 * 60 * 1000);
    await call({ mode: "subscription" });

    const keys = mocks.createSession.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys[0]).not.toBe(keys[1]);
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
