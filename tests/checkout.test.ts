import { beforeEach, describe, expect, it, vi } from "vitest";
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
  process.env.STRIPE_PRICE_ID_ONE_TIME = "price_episode_server";
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
  it.each(["subscription", "one_time"])("requires authentication for %s checkout", async (mode) => {
    mocks.requireUser.mockRejectedValue(authError("Missing Authorization Bearer token"));
    const { result } = await call(
      mode === "subscription"
        ? { mode }
        : { mode, episodeId: "conversation-ep2" }
    );
    expect(result.statusCode).toBe(401);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it.each([
    { mode: "one_time" },
    { mode: "one_time", episodeId: "" },
    { mode: "one_time", episodeId: "invented-ep99" },
    { mode: "one_time", episodeId: "../full.mp3" },
  ])("rejects invalid episode request %#", async (body) => {
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

  it("accepts canonical one-time checkout with server price and trusted metadata", async () => {
    const { result } = await call({
      mode: "one_time",
      episodeId: "love-him-anyway-15",
    });
    expect(result.statusCode).toBe(200);
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        customer: "customer-linked",
        line_items: [{ price: "price_episode_server", quantity: 1 }],
        client_reference_id: "user-current",
        metadata: {
          userId: "user-current",
          purchaseType: "one_time",
          episodeId: "love-him-anyway-15",
        },
      })
    );
  });

  it("creates subscription checkout using only server configuration", async () => {
    const { result } = await call({ mode: "subscription" });
    expect(result.statusCode).toBe(200);
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_subscription_server", quantity: 1 }],
        metadata: { userId: "user-current", purchaseType: "subscription" },
      })
    );
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
