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
  process.env.STRIPE_PRICE_ID_SUBSCRIPTION = "price_subscription_server";
  process.env.SITE_URL = "https://site.invalid";
  mocks.requireUser.mockResolvedValue({ id: "user-current", email: "trusted" });
  mocks.profileResult = {
    data: { id: "user-current", stripe_customer_id: "customer-linked" },
    error: null,
  };
  mocks.retrieveCustomer.mockResolvedValue({ email: "trusted" });
  mocks.createCustomer.mockResolvedValue({ id: "customer-created" });
  mocks.profileUpsert.mockResolvedValue({ error: null });
  mocks.createSession.mockResolvedValue({ url: "https://checkout.invalid/path" });
});

async function call(body: unknown) {
  const output = response();
  await checkout(request({ method: "POST", body }), output.res);
  return output;
}

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

  it("returns generic failure without raw Stripe identifiers", async () => {
    mocks.createSession.mockRejectedValue(new Error("customer-sensitive raw failure"));
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({ error: "Unable to start checkout." });
  });
});
