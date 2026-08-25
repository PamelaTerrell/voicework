import { beforeEach, describe, expect, it, vi } from "vitest";
import { authError, request, response } from "./helpers.js";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  profileResult: { data: null as unknown, error: null as unknown },
  profileEq: vi.fn(),
  profileUpdate: vi.fn(),
  profileUpdateEq: vi.fn(),
  retrieveCustomer: vi.fn(),
  listSubscriptions: vi.fn(),
  updateSubscription: vi.fn(),
}));

vi.mock("../api/_lib.js", () => ({
  isActiveSub: (status?: string | null) =>
    status === "active" || status === "trialing",
  normalizeEmail: (value?: string | null) =>
    value?.trim().toLowerCase() ?? null,
  requireUser: mocks.requireUser,
  stripe: {
    customers: { retrieve: mocks.retrieveCustomer },
    subscriptions: {
      list: mocks.listSubscriptions,
      update: mocks.updateSubscription,
    },
  },
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: mocks.profileEq.mockImplementation(() => ({
          maybeSingle: async () => mocks.profileResult,
        })),
      }),
      update: mocks.profileUpdate.mockImplementation(() => ({
        eq: mocks.profileUpdateEq.mockImplementation(async () => ({ error: null })),
      })),
    }),
  },
}));

import cancelMembership from "../api/cancel-membership.js";

const future = () => Math.floor(Date.now() / 1000) + 3600;

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: "subscription-linked",
  customer: "customer-linked",
  status: "active",
  cancel_at_period_end: false,
  cancel_at: null,
  current_period_end: future(),
  ...overrides,
});

async function call(body?: unknown) {
  const result = response();
  await cancelMembership(request({ method: "POST", body }), result.res);
  expect(result.result.headers.get("cache-control")).toBe("no-store");
  expect(result.result.headers.get("vary")).toBe("Authorization");
  return result.result;
}

beforeEach(() => {
  mocks.requireUser.mockResolvedValue({ id: "user-current", email: "trusted" });
  mocks.profileResult = {
    data: { id: "user-current", stripe_customer_id: "customer-linked" },
    error: null,
  };
  mocks.retrieveCustomer.mockResolvedValue({
    id: "customer-linked",
    email: "trusted",
  });
  mocks.listSubscriptions.mockResolvedValue({
    data: [subscription()],
    has_more: false,
  });
  mocks.updateSubscription.mockImplementation(async () =>
    subscription({ cancel_at_period_end: true }),
  );
});

describe("authenticated membership cancellation", () => {
  it("accepts only POST", async () => {
    const { res, result } = response();
    await cancelMembership(request({ method: "GET" }), res);
    expect(result.statusCode).toBe(405);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("vary")).toBe("Authorization");
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });

  it.each(["Missing Authorization Bearer token", "Invalid token"])(
    "returns a controlled authentication response for %s",
    async (message) => {
      mocks.requireUser.mockRejectedValue(authError(message));
      const result = await call();
      expect(result.statusCode).toBe(401);
      expect(JSON.stringify(result.body)).not.toContain("token");
    },
  );

  it("requires the authenticated user's trusted email", async () => {
    mocks.requireUser.mockResolvedValue({ id: "user-current" });
    const result = await call();
    expect(result.statusCode).toBe(400);
    expect(mocks.profileEq).not.toHaveBeenCalled();
  });

  it.each([
    { userId: "user-other" },
    { email: "nominated" },
    { customerId: "customer-other" },
    { stripeCustomerId: "customer-other" },
    { subscriptionId: "subscription-other" },
    { membershipStatus: "active" },
    { cancellationEffectiveAt: future() },
  ])("rejects browser-supplied identity or billing input %#", async (body) => {
    const result = await call(body);
    expect(result.statusCode).toBe(400);
    expect(mocks.profileEq).not.toHaveBeenCalled();
    expect(mocks.retrieveCustomer).not.toHaveBeenCalled();
  });

  it.each([
    ["missing profile", null],
    ["missing customer association", { id: "user-current", stripe_customer_id: null }],
  ])("fails closed for %s", async (_label, profile) => {
    mocks.profileResult = { data: profile, error: null };
    const result = await call();
    expect(result.statusCode).toBe(400);
    expect(mocks.profileEq).toHaveBeenCalledWith("id", "user-current");
    expect(mocks.retrieveCustomer).not.toHaveBeenCalled();
  });

  it.each([
    ["deleted customer", { id: "customer-linked", deleted: true, email: "trusted" }],
    ["customer email mismatch", { id: "customer-linked", email: "different" }],
  ])("rejects a %s", async (_label, customer) => {
    mocks.retrieveCustomer.mockResolvedValue(customer);
    const result = await call();
    expect(result.statusCode).toBe(400);
    expect(mocks.listSubscriptions).not.toHaveBeenCalled();
  });

  it.each(["past_due", "unpaid", "incomplete", "canceled"])(
    "does not cancel a %s subscription",
    async (status) => {
      mocks.listSubscriptions.mockResolvedValue({
        data: [subscription({ status })],
        has_more: false,
      });
      const result = await call();
      expect(result.statusCode).toBe(400);
      expect(mocks.updateSubscription).not.toHaveBeenCalled();
    },
  );

  it.each(["active", "trialing"])(
    "schedules one verified %s subscription at period end",
    async (status) => {
      const paidThrough = future();
      mocks.listSubscriptions.mockResolvedValue({
        data: [subscription({ status, current_period_end: paidThrough })],
        has_more: false,
      });
      mocks.updateSubscription.mockResolvedValue(
        subscription({ status, cancel_at_period_end: true, current_period_end: paidThrough }),
      );
      const result = await call();
      expect(mocks.updateSubscription).toHaveBeenCalledWith(
        "subscription-linked",
        { cancel_at_period_end: true },
      );
      expect(mocks.profileUpdateEq).toHaveBeenCalledWith("id", "user-current");
      expect(result.body).toEqual({
        cancellationScheduled: true,
        cancellationEffectiveAt: paidThrough,
        alreadyScheduled: false,
      });
    },
  );

  it("handles an already scheduled cancellation idempotently", async () => {
    const paidThrough = future();
    mocks.listSubscriptions.mockResolvedValue({
      data: [subscription({ cancel_at_period_end: true, current_period_end: paidThrough })],
      has_more: false,
    });
    const first = await call();
    const second = await call();
    expect(mocks.updateSubscription).not.toHaveBeenCalled();
    expect(first.body).toEqual(second.body);
    expect(first.body).toEqual({
      cancellationScheduled: true,
      cancellationEffectiveAt: paidThrough,
      alreadyScheduled: true,
    });
  });

  it("fails closed for multiple candidates, pagination, or unclear ownership", async () => {
    mocks.listSubscriptions.mockResolvedValueOnce({
      data: [subscription(), subscription({ id: "subscription-second" })],
      has_more: false,
    });
    expect((await call()).statusCode).toBe(409);

    mocks.listSubscriptions.mockResolvedValueOnce({
      data: [subscription()],
      has_more: true,
    });
    expect((await call()).statusCode).toBe(409);

    mocks.listSubscriptions.mockResolvedValueOnce({
      data: [subscription({ customer: "customer-other" })],
      has_more: false,
    });
    expect((await call()).statusCode).toBe(409);
    expect(mocks.updateSubscription).not.toHaveBeenCalled();
  });

  it.each([
    ["missing current period", { current_period_end: null }],
    ["expired current period", { current_period_end: 1 }],
  ])("rejects successful updates with %s", async (_label, overrides) => {
    mocks.updateSubscription.mockResolvedValue(
      subscription({ cancel_at_period_end: true, ...overrides }),
    );
    const result = await call();
    expect(result.statusCode).toBe(409);
  });

  it("does not trust a mismatched subscription returned by Stripe update", async () => {
    mocks.updateSubscription.mockResolvedValue(
      subscription({ customer: "customer-other", cancel_at_period_end: true }),
    );
    expect((await call()).statusCode).toBe(409);
  });

  it.each(["customer retrieval", "subscription listing", "subscription update"])(
    "returns no raw provider details when %s fails",
    async (operation) => {
      const providerMessage = "provider-private-diagnostic";
      if (operation === "customer retrieval") {
        mocks.retrieveCustomer.mockRejectedValue(new Error(providerMessage));
      } else if (operation === "subscription listing") {
        mocks.listSubscriptions.mockRejectedValue(new Error(providerMessage));
      } else {
        mocks.updateSubscription.mockRejectedValue(new Error(providerMessage));
      }
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const result = await call();
      expect(result.statusCode).toBe(500);
      expect(JSON.stringify(result.body)).not.toContain(providerMessage);
      expect(log).toHaveBeenCalledWith(
        "Unable to process authenticated membership cancellation.",
      );
    },
  );

  it("returns only the minimal cancellation state", async () => {
    const result = await call();
    expect(Object.keys(result.body as object).sort()).toEqual([
      "alreadyScheduled",
      "cancellationEffectiveAt",
      "cancellationScheduled",
    ]);
    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain("customer-linked");
    expect(serialized).not.toContain("subscription-linked");
    expect(serialized).not.toContain("trusted");
  });
});
