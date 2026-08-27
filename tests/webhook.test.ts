import { beforeEach, describe, expect, it, vi } from "vitest";
import { request, response } from "./helpers.js";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  entitlementUpsert: vi.fn(),
  profileUpsert: vi.fn(),
  profileUpdate: vi.fn(),
  profileEq: vi.fn(),
  transitionAttempt: vi.fn(),
  invalidateOwnedAttempt: vi.fn(),
}));

vi.mock("../api/_checkoutAttempt.js", () => ({
  transitionAttemptFromVerifiedSession: mocks.transitionAttempt,
  invalidateOwnedOpenAttemptForCustomer: mocks.invalidateOwnedAttempt,
}));

vi.mock("../api/_lib.js", () => ({
  stripe: {
    webhooks: { constructEvent: mocks.constructEvent },
  },
  readRawBody: vi.fn(async () => Buffer.from("isolated")),
  isActiveSub: (status?: string | null) =>
    status === "active" || status === "trialing",
  normalizeEmail: (value?: string | null) => value?.trim().toLowerCase() ?? null,
  getCustomerEmail: vi.fn(async () => "trusted"),
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "entitlements") return { upsert: mocks.entitlementUpsert };
      return {
        upsert: mocks.profileUpsert,
        select: () => ({
          eq: mocks.profileEq.mockImplementation(() => ({
            maybeSingle: async () => ({ data: null, error: null }),
          })),
        }),
        update: mocks.profileUpdate.mockImplementation(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      };
    },
  },
}));

import webhook from "../api/stripe-webhook.js";

function checkoutEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1234567890abcdef",
        mode: "payment",
        status: "complete",
        payment_status: "paid",
        client_reference_id: "user-current",
        customer: "customer-linked",
        customer_details: { email: "trusted" },
        metadata: {
          userId: "user-current",
          purchaseType: "one_time",
          episodeId: "conversation-ep2",
        },
        subscription: null,
        success_url: "https://site.invalid/thanks?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://site.invalid/listen?canceled=1",
        expires_at: 9999999999,
        ...overrides,
      },
    },
  };
}

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "test-only-placeholder";
  mocks.constructEvent.mockReturnValue(checkoutEvent());
  mocks.entitlementUpsert.mockResolvedValue({ error: null });
  mocks.profileUpsert.mockResolvedValue({ error: null });
  mocks.transitionAttempt.mockResolvedValue(undefined);
  mocks.invalidateOwnedAttempt.mockResolvedValue(undefined);
});

async function call(signature: string | null = "isolated-signature") {
  const output = response();
  await webhook(
    request({
      method: "POST",
      headers: signature ? { "stripe-signature": signature } : {},
    }),
    output.res
  );
  expect(output.result.headers.get("cache-control")).toBe("no-store");
  expect(output.result.headers.has("vary")).toBe(false);
  return output;
}

it("sets no-store without authorization-dependent behavior on unsupported methods", async () => {
  const output = response();
  await webhook(request({ method: "GET" }), output.res);
  expect(output.result.statusCode).toBe(405);
  expect(output.result.headers.get("cache-control")).toBe("no-store");
  expect(output.result.headers.has("vary")).toBe(false);
});

describe("Stripe webhook authorization", () => {
  it("rejects missing and invalid signatures without exposing secrets", async () => {
    let output = await call(null);
    expect(output.result.statusCode).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();

    mocks.constructEvent.mockImplementation(() => {
      throw new Error("secret raw verification detail");
    });
    output = await call();
    expect(output.result).toEqual({
      statusCode: 400,
      body: "Invalid webhook signature",
    });
  });

  it.each([
    { status: "open" },
    { payment_status: "unpaid" },
    { client_reference_id: "user-other" },
    { metadata: { userId: "user-current", purchaseType: "one_time" } },
    {
      metadata: {
        userId: "user-current",
        purchaseType: "one_time",
        episodeId: "invented-ep99",
      },
    },
  ])("does not create entitlement for unsafe checkout %#", async (overrides) => {
    mocks.constructEvent.mockReturnValue(checkoutEvent(overrides));
    expect((await call()).result.statusCode).toBe(200);
    expect(mocks.entitlementUpsert).not.toHaveBeenCalled();
  });

  it("creates only the canonical entitlement for the trusted user", async () => {
    await call();
    expect(mocks.entitlementUpsert).toHaveBeenCalledWith(
      {
        user_id: "user-current",
        episode_id: "conversation-ep2",
        source: "stripe_one_time",
      },
      { onConflict: "user_id,episode_id" }
    );
  });

  it("keeps duplicate deliveries idempotent through the unique conflict target", async () => {
    await call();
    await call();
    expect(mocks.entitlementUpsert).toHaveBeenCalledTimes(2);
    for (const invocation of mocks.entitlementUpsert.mock.calls) {
      expect(invocation[1]).toEqual({ onConflict: "user_id,episode_id" });
    }
  });

  it("requires trusted linkage before subscription access", async () => {
    mocks.constructEvent.mockReturnValue(
      checkoutEvent({
        mode: "subscription",
        metadata: { userId: "user-current", purchaseType: "subscription" },
        subscription: "subscription-linked",
      })
    );
    await call();
    expect(mocks.profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-current", is_subscriber: true }),
      { onConflict: "id" }
    );
    expect(mocks.transitionAttempt).toHaveBeenCalledWith(
      "user-current",
      expect.objectContaining({ id: "cs_test_1234567890abcdef" }),
    );

    vi.clearAllMocks();
    mocks.constructEvent.mockReturnValue(
      checkoutEvent({
        mode: "subscription",
        client_reference_id: null,
        metadata: { userId: "user-current", purchaseType: "subscription" },
        subscription: "subscription-linked",
      })
    );
    await call();
    expect(mocks.profileUpsert).not.toHaveBeenCalled();
    expect(mocks.transitionAttempt).not.toHaveBeenCalled();
  });

  it("does not invalidate an in-progress Checkout for an incomplete subscription creation", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "customer.subscription.created",
      data: {
        object: {
          customer: "customer-linked",
          status: "incomplete",
        },
      },
    });
    expect((await call()).result.statusCode).toBe(200);
    expect(mocks.invalidateOwnedAttempt).not.toHaveBeenCalled();
  });

  it.each(["active", "trialing"])(
    "invalidates an owned open attempt when subscription status is %s",
    async (status) => {
      mocks.constructEvent.mockReturnValue({
        type: "customer.subscription.created",
        data: {
          object: {
            customer: "customer-linked",
            status,
          },
        },
      });
      await call();
      expect(mocks.invalidateOwnedAttempt).toHaveBeenCalledWith(
        "customer-linked",
      );
    },
  );

  it.each(["past_due", "paused", "unpaid"])(
    "invalidates an owned open attempt for attention-required status %s",
    async (status) => {
      mocks.constructEvent.mockReturnValue({
        type: "customer.subscription.updated",
        data: {
          object: {
            customer: "customer-linked",
            status,
          },
        },
      });
      await call();
      expect(mocks.invalidateOwnedAttempt).toHaveBeenCalledWith(
        "customer-linked",
      );
    },
  );

  it("keeps webhook retry behavior when owned Session invalidation is ambiguous", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "customer.subscription.created",
      data: {
        object: {
          customer: "customer-linked",
          status: "active",
        },
      },
    });
    mocks.invalidateOwnedAttempt.mockRejectedValue(new Error("isolated"));
    expect((await call()).result.statusCode).toBe(500);
  });

  it("ignores unsupported events and logs only a generic processing failure", async () => {
    mocks.constructEvent.mockReturnValue({ type: "product.updated", data: { object: {} } });
    expect((await call()).result.statusCode).toBe(200);

    mocks.constructEvent.mockReturnValue(checkoutEvent());
    mocks.entitlementUpsert.mockResolvedValue({ error: new Error("raw customer data") });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const output = await call();
    expect(output.result.body).toBe("Webhook handler failed");
    expect(log).toHaveBeenCalledWith("Stripe webhook processing failed.");
  });
});
