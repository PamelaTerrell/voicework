import { beforeEach, describe, expect, it, vi } from "vitest";
import { authError, request, response } from "./helpers.js";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  validateMembership: vi.fn(),
  profileResult: { data: null as unknown, error: null as unknown },
  profileEq: vi.fn(),
  retrieveCustomer: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("../api/_membership.js", () => ({
  validateAuthenticatedMembership: mocks.validateMembership,
}));

vi.mock("../api/_lib.js", () => ({
  normalizeEmail: (value?: string | null) => value?.trim().toLowerCase() ?? null,
  requireUser: mocks.requireUser,
  stripe: {
    customers: { retrieve: mocks.retrieveCustomer },
    checkout: { sessions: { create: mocks.createSession } },
  },
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: mocks.profileEq.mockImplementation(() => ({
          maybeSingle: async () => mocks.profileResult,
        })),
      }),
    }),
  },
}));

import memberAccess from "../api/member-access.js";
import resumeMembership from "../api/resume-membership.js";

beforeEach(() => {
  process.env.STRIPE_PRICE_ID_SUBSCRIPTION = "price_server";
  process.env.SITE_URL = "https://site.invalid";
  mocks.requireUser.mockResolvedValue({ id: "user-current", email: "trusted" });
  mocks.validateMembership.mockResolvedValue({
    active: false,
    cancellationScheduled: false,
    cancellationEffectiveAt: null,
  });
  mocks.profileResult = {
    data: { id: "user-current", stripe_customer_id: "customer-linked" },
    error: null,
  };
  mocks.retrieveCustomer.mockResolvedValue({ email: "trusted" });
  mocks.createSession.mockResolvedValue({ url: "https://checkout.invalid/path" });
});

describe("member access endpoint", () => {
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
      active: true,
      cancellationScheduled: false,
      cancellationEffectiveAt: null,
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
});

describe("resume membership endpoint", () => {
  it("accepts only POST", async () => {
    const { res, result } = response();
    await resumeMembership(request({ method: "GET" }), res);
    expect(result.statusCode).toBe(405);
  });

  it("rejects missing authentication and browser customer IDs", async () => {
    mocks.requireUser.mockRejectedValueOnce(authError("Missing Authorization Bearer token"));
    let call = response();
    await resumeMembership(request({ method: "POST" }), call.res);
    expect(call.result.statusCode).toBe(401);

    mocks.requireUser.mockResolvedValue({ id: "user-current", email: "trusted" });
    call = response();
    await resumeMembership(
      request({ method: "POST", body: { customerId: "customer-other" } }),
      call.res
    );
    expect(call.result.statusCode).toBe(400);
    expect(mocks.retrieveCustomer).not.toHaveBeenCalled();
  });

  it("scopes the profile and checkout metadata to the authenticated user", async () => {
    const { res, result } = response();
    await resumeMembership(request({ method: "POST", body: {} }), res);
    expect(result.statusCode).toBe(200);
    expect(mocks.profileEq).toHaveBeenCalledWith("id", "user-current");
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "customer-linked",
        line_items: [{ price: "price_server", quantity: 1 }],
        metadata: { userId: "user-current", purchaseType: "subscription" },
      })
    );
    expect(result.body).toEqual({ url: "https://checkout.invalid/path" });
  });

  it("does not expose profile, email, or billing identifiers on failure", async () => {
    mocks.profileResult = { data: null, error: null };
    const { res, result } = response();
    await resumeMembership(request({ method: "POST" }), res);
    expect(result.statusCode).toBe(400);
    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain("customer-linked");
    expect(serialized).not.toContain("trusted");
  });
});
