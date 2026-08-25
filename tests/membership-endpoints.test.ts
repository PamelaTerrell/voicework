import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { authError, request, response } from "./helpers.js";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  validateMembership: vi.fn(),
  profileResult: { data: null as unknown, error: null as unknown },
  profileEq: vi.fn(),
  profileUpdate: vi.fn(),
  profileUpdateEq: vi.fn(),
  retrieveCustomer: vi.fn(),
  listSubscriptions: vi.fn(),
  updateSubscription: vi.fn(),
}));

vi.mock("../api/_membership.js", () => ({
  reconcileAuthenticatedMembership: mocks.validateMembership,
}));

vi.mock("../api/_lib.js", () => ({
  normalizeEmail: (value?: string | null) => value?.trim().toLowerCase() ?? null,
  isActiveSub: (status?: string | null) =>
    status === "active" || status === "trialing",
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

import memberAccess from "../api/member-access.js";
import resumeMembership from "../api/resume-membership.js";

beforeEach(() => {
  mocks.requireUser.mockResolvedValue({ id: "user-current", email: "trusted" });
  mocks.validateMembership.mockResolvedValue({
    outcome: "inactive",
    active: false,
    cancellationScheduled: false,
    cancellationEffectiveAt: null,
    customerId: null,
  });
  mocks.profileResult = {
    data: { id: "user-current", stripe_customer_id: "customer-linked" },
    error: null,
  };
  mocks.retrieveCustomer.mockResolvedValue({ id: "customer-linked", email: "trusted" });
  mocks.listSubscriptions.mockResolvedValue({
    data: [subscription()],
    has_more: false,
  });
  mocks.updateSubscription.mockResolvedValue(
    subscription({ cancel_at_period_end: false }),
  );
});

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: "subscription-linked",
  customer: "customer-linked",
  status: "active",
  cancel_at_period_end: true,
  cancel_at: null,
  ...overrides,
});

describe("member access endpoint", () => {
  it("sets authenticated cache headers on success and unsupported methods", async () => {
    let output = response();
    await memberAccess(request(), output.res);
    expect(output.result.statusCode).toBe(200);
    expect(output.result.headers.get("cache-control")).toBe("no-store");
    expect(output.result.headers.get("vary")).toBe("Authorization");

    output = response();
    await memberAccess(request({ method: "POST" }), output.res);
    expect(output.result.statusCode).toBe(405);
    expect(output.result.headers.get("cache-control")).toBe("no-store");
    expect(output.result.headers.get("vary")).toBe("Authorization");
  });

  it.each(["Missing Authorization Bearer token", "Invalid token"])(
    "rejects authentication failure: %s",
    async (message) => {
      mocks.requireUser.mockRejectedValue(authError(message));
      const { res, result } = response();
      await memberAccess(request(), res);
      expect(result.statusCode).toBe(401);
      expect(JSON.stringify(result.body)).not.toContain("token");
    }
  );

  it.each([
    { query: { email: "nominated" } },
    { query: { userId: "other-user" } },
    { body: { email: "nominated" } },
    { body: { userId: "other-user" } },
  ])("rejects legacy identity input %#", async (overrides) => {
    const { res, result } = response();
    await memberAccess(request(overrides), res);
    expect(result.statusCode).toBe(400);
    expect(mocks.validateMembership).not.toHaveBeenCalled();
  });

  it("uses trusted reconciliation and returns minimal membership state", async () => {
    mocks.validateMembership.mockResolvedValue({
      outcome: "active",
      active: true,
      cancellationScheduled: false,
      cancellationEffectiveAt: null,
      customerId: "customer-linked",
    });
    const { res, result } = response();
    await memberAccess(request(), res);
    expect(mocks.validateMembership).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-current" }),
      { reconcileByVerifiedEmail: true }
    );
    expect(result.body).toEqual({
      ok: true,
      isSubscriber: true,
      membershipStatus: "active",
      cancellationScheduled: false,
      cancellationEffectiveAt: null,
    });
  });

  it.each(["conflict", "unavailable"])(
    "does not present %s verification as confirmed inactivity",
    async (outcome) => {
      mocks.validateMembership.mockResolvedValue({
        outcome,
        active: false,
        cancellationScheduled: false,
        cancellationEffectiveAt: null,
        customerId: null,
      });
      const { res, result } = response();
      await memberAccess(request(), res);
      expect(result.statusCode).toBe(503);
      expect(result.body).toEqual({ error: "Unable to verify membership." });
    },
  );

  it("keeps the Members unlock state hidden after membership verification errors", () => {
    const client = readFileSync(resolve("src/pages/Members.tsx"), "utf8");
    expect(client).toContain("!membershipUnavailable");
    expect(client).toContain("setMembershipUnavailable(true)");
  });
});

describe("resume membership endpoint", () => {
  it("sets authenticated cache headers on successful resumption", async () => {
    const { res, result } = response();
    await resumeMembership(request({ method: "POST" }), res);
    expect(result.statusCode).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("vary")).toBe("Authorization");
  });

  it("accepts only POST", async () => {
    const { res, result } = response();
    await resumeMembership(request({ method: "GET" }), res);
    expect(result.statusCode).toBe(405);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("vary")).toBe("Authorization");
  });

  it.each(["Missing Authorization Bearer token", "Invalid token"])(
    "rejects authentication failure: %s",
    async (message) => {
      mocks.requireUser.mockRejectedValue(authError(message));
      const { res, result } = response();
      await resumeMembership(request({ method: "POST" }), res);
      expect(result.statusCode).toBe(401);
      expect(JSON.stringify(result.body)).not.toContain("token");
    },
  );

  it.each([
    { body: { userId: "user-other" } },
    { body: { email: "nominated" } },
    { body: { customerId: "customer-other" } },
    { body: { subscriptionId: "subscription-other" } },
    { body: { status: "active" } },
    { body: { priceId: "price-other" } },
    { body: { cancel_at_period_end: false } },
    { query: { customerId: "customer-other" } },
  ])("rejects browser-supplied parameters %#", async (overrides) => {
    const { res, result } = response();
    await resumeMembership(request({ method: "POST", ...overrides }), res);
    expect(result.statusCode).toBe(400);
    expect(mocks.profileEq).not.toHaveBeenCalled();
  });

  it("requires trusted email and profile linkage scoped to the user", async () => {
    mocks.requireUser.mockResolvedValueOnce({ id: "user-current" });
    let output = response();
    await resumeMembership(request({ method: "POST" }), output.res);
    expect(output.result.statusCode).toBe(400);

    mocks.requireUser.mockResolvedValue({ id: "user-current", email: "trusted" });
    mocks.profileResult = { data: null, error: null };
    output = response();
    await resumeMembership(request({ method: "POST" }), output.res);
    expect(output.result.statusCode).toBe(400);
    expect(mocks.profileEq).toHaveBeenCalledWith("id", "user-current");

    mocks.profileResult = {
      data: { id: "user-current", stripe_customer_id: null },
      error: null,
    };
    output = response();
    await resumeMembership(request({ method: "POST" }), output.res);
    expect(output.result.statusCode).toBe(400);
  });

  it("returns controlled profile lookup and synchronization failures", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.profileResult = { data: null, error: new Error("profile-private") };
    let output = response();
    await resumeMembership(request({ method: "POST" }), output.res);
    expect(output.result.statusCode).toBe(500);
    expect(JSON.stringify(output.result.body)).not.toContain("profile-private");

    mocks.profileResult = {
      data: { id: "user-current", stripe_customer_id: "customer-linked" },
      error: null,
    };
    mocks.profileUpdateEq.mockResolvedValueOnce({ error: new Error("sync-private") });
    output = response();
    await resumeMembership(request({ method: "POST" }), output.res);
    expect(output.result.statusCode).toBe(500);
    expect(JSON.stringify(output.result.body)).not.toContain("sync-private");
    expect(log).toHaveBeenCalledWith(
      "Unable to synchronize authenticated membership resumption.",
    );
  });

  it.each([
    { deleted: true, email: "trusted" },
    { id: "customer-linked", email: "different" },
  ])("rejects deleted or mismatched customer %#", async (customer) => {
    mocks.retrieveCustomer.mockResolvedValue(customer);
    const { res, result } = response();
    await resumeMembership(request({ method: "POST" }), res);
    expect(result.statusCode).toBe(400);
    expect(mocks.listSubscriptions).not.toHaveBeenCalled();
  });

  it.each(["past_due", "unpaid", "incomplete", "canceled"])(
    "does not resume a %s subscription",
    async (status) => {
      mocks.listSubscriptions.mockResolvedValue({
        data: [subscription({ status })],
        has_more: false,
      });
      const { res, result } = response();
      await resumeMembership(request({ method: "POST" }), res);
      expect(result.statusCode).toBe(400);
      expect(mocks.updateSubscription).not.toHaveBeenCalled();
    },
  );

  it("fails closed for zero, multiple, paginated, or mismatched subscriptions", async () => {
    mocks.listSubscriptions.mockResolvedValueOnce({ data: [], has_more: false });
    let output = response();
    await resumeMembership(request({ method: "POST" }), output.res);
    expect(output.result.statusCode).toBe(400);

    mocks.listSubscriptions.mockResolvedValueOnce({
      data: [subscription(), subscription({ id: "subscription-second" })],
      has_more: false,
    });
    output = response();
    await resumeMembership(request({ method: "POST" }), output.res);
    expect(output.result.statusCode).toBe(409);

    mocks.listSubscriptions.mockResolvedValueOnce({ data: [subscription()], has_more: true });
    output = response();
    await resumeMembership(request({ method: "POST" }), output.res);
    expect(output.result.statusCode).toBe(409);

    mocks.listSubscriptions.mockResolvedValueOnce({
      data: [subscription({ customer: "customer-other" })],
      has_more: false,
    });
    output = response();
    await resumeMembership(request({ method: "POST" }), output.res);
    expect(output.result.statusCode).toBe(409);
  });

  it.each(["active", "trialing"])(
    "resumes one verified canceling %s subscription",
    async (status) => {
      mocks.listSubscriptions.mockResolvedValue({
        data: [subscription({ status })],
        has_more: false,
      });
      mocks.updateSubscription.mockResolvedValue(
        subscription({ status, cancel_at_period_end: false }),
      );
      const { res, result } = response();
      await resumeMembership(request({ method: "POST" }), res);
      expect(mocks.updateSubscription).toHaveBeenCalledWith(
        "subscription-linked",
        { cancel_at_period_end: false },
      );
      expect(mocks.profileUpdate).toHaveBeenCalledWith({
        is_subscriber: true,
        subscription_status: status,
      });
      expect(mocks.profileUpdateEq).toHaveBeenCalledWith("id", "user-current");
      expect(result.body).toEqual({ resumed: true, alreadyActive: false });
    },
  );

  it("handles an already active subscription without a Stripe update", async () => {
    mocks.listSubscriptions.mockResolvedValue({
      data: [subscription({ cancel_at_period_end: false })],
      has_more: false,
    });
    const { res, result } = response();
    await resumeMembership(request({ method: "POST" }), res);
    expect(mocks.updateSubscription).not.toHaveBeenCalled();
    expect(result.body).toEqual({ resumed: true, alreadyActive: true });
  });

  it("rejects an unfamiliar explicit cancellation schedule", async () => {
    mocks.listSubscriptions.mockResolvedValue({
      data: [subscription({ cancel_at: 9999999999 })],
      has_more: false,
    });
    const { res, result } = response();
    await resumeMembership(request({ method: "POST" }), res);
    expect(result.statusCode).toBe(409);
    expect(mocks.updateSubscription).not.toHaveBeenCalled();
  });

  it.each([
    { customer: "customer-other", cancel_at_period_end: false },
    { cancel_at_period_end: true },
    { cancel_at_period_end: false, cancel_at: 9999999999 },
    { cancel_at_period_end: false, status: "past_due" },
  ])("rejects an unverified Stripe update result %#", async (overrides) => {
    mocks.updateSubscription.mockResolvedValue(subscription(overrides));
    const { res, result } = response();
    await resumeMembership(request({ method: "POST" }), res);
    expect(result.statusCode).toBe(409);
    expect(mocks.profileUpdate).not.toHaveBeenCalled();
  });

  it.each(["customer", "list", "update"])(
    "returns no raw details when the %s provider call fails",
    async (operation) => {
      const diagnostic = "provider-private-diagnostic";
      if (operation === "customer") mocks.retrieveCustomer.mockRejectedValue(new Error(diagnostic));
      if (operation === "list") mocks.listSubscriptions.mockRejectedValue(new Error(diagnostic));
      if (operation === "update") mocks.updateSubscription.mockRejectedValue(new Error(diagnostic));
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { res, result } = response();
      await resumeMembership(request({ method: "POST" }), res);
      expect(result.statusCode).toBe(500);
      const serialized = JSON.stringify(result.body);
      expect(serialized).not.toContain(diagnostic);
      expect(serialized).not.toContain("customer-linked");
      expect(log).toHaveBeenCalledWith(
        "Unable to process authenticated membership resumption.",
      );
    },
  );

  it("returns minimal state without checkout or billing identifiers", async () => {
    const { res, result } = response();
    await resumeMembership(request({ method: "POST" }), res);
    expect(Object.keys(result.body as object).sort()).toEqual([
      "alreadyActive",
      "resumed",
    ]);
    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain("url");
    expect(serialized).not.toContain("customer");
    expect(serialized).not.toContain("subscription");
    expect(serialized).not.toContain("trusted");
    expect(serialized).not.toContain("price");
  });

  it("contains no checkout creation and the client does not expect a resume URL", () => {
    const endpoint = readFileSync(resolve("api/resume-membership.ts"), "utf8");
    const client = readFileSync(resolve("src/pages/Members.tsx"), "utf8");
    const resumeClient = client.slice(client.indexOf("async function handleResumeMembership"));

    expect(endpoint).not.toContain("checkout.sessions.create");
    expect(endpoint).not.toContain("STRIPE_PRICE_ID");
    expect(resumeClient).not.toContain("result.url");
    expect(resumeClient).not.toContain("window.location.href");
  });
});
