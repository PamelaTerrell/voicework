import { beforeEach, describe, expect, it, vi } from "vitest";
import { authError, request, response } from "./helpers.js";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  retrieveSession: vi.fn(),
}));

vi.mock("../api/_lib.js", () => ({
  isActiveSub: (status?: string | null) =>
    status === "active" || status === "trialing",
  requireUser: mocks.requireUser,
  stripe: { checkout: { sessions: { retrieve: mocks.retrieveSession } } },
}));

import checkoutSession from "../api/checkout-session.js";

const validId = "cs_test_1234567890abcdef";

function session(overrides: Record<string, unknown> = {}) {
  return {
    status: "complete",
    payment_status: "paid",
    mode: "payment",
    client_reference_id: "user-current",
    metadata: {
      userId: "user-current",
      purchaseType: "one_time",
      episodeId: "conversation-ep2",
    },
    subscription: null,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.requireUser.mockResolvedValue({ id: "user-current", email: "trusted" });
  mocks.retrieveSession.mockResolvedValue(session());
});

async function call(sessionId = validId) {
  const output = response();
  await checkoutSession(
    request({ method: "GET", query: { session_id: sessionId } }),
    output.res
  );
  expect(output.result.headers.get("cache-control")).toBe("no-store");
  expect(output.result.headers.get("vary")).toBe("Authorization");
  return output;
}

it("sets authenticated cache headers on unsupported methods", async () => {
  const output = response();
  await checkoutSession(request({ method: "POST" }), output.res);
  expect(output.result.statusCode).toBe(405);
  expect(output.result.headers.get("cache-control")).toBe("no-store");
  expect(output.result.headers.get("vary")).toBe("Authorization");
});

describe("checkout session verification", () => {
  it("requires authentication", async () => {
    mocks.requireUser.mockRejectedValue(authError("Missing Authorization Bearer token"));
    expect((await call()).result.statusCode).toBe(401);
    expect(mocks.retrieveSession).not.toHaveBeenCalled();
  });

  it.each(["", "cs_bad", "../cs_test_1234567890"])(
    "rejects missing or malformed session ID %j before lookup",
    async (value) => {
      expect((await call(value)).result).toEqual({
        statusCode: 400,
        body: { state: "invalid" },
      });
      expect(mocks.retrieveSession).not.toHaveBeenCalled();
    }
  );

  it("rejects a session belonging to another user", async () => {
    mocks.retrieveSession.mockResolvedValue(
      session({
        client_reference_id: "user-other",
        metadata: {
          userId: "user-other",
          purchaseType: "one_time",
          episodeId: "conversation-ep2",
        },
      })
    );
    expect((await call()).result.statusCode).toBe(404);
  });

  it.each([
    [{ status: "open" }, "pending"],
    [{ payment_status: "unpaid" }, "pending"],
    [{ status: "expired" }, "failed"],
  ])("returns %s state without granting success", async (overrides, state) => {
    mocks.retrieveSession.mockResolvedValue(session(overrides));
    expect((await call()).result.body).toEqual({
      state,
      purchaseType: "one_time",
    });
  });

  it("verifies a completed canonical one-time purchase with minimal fields", async () => {
    const { result } = await call();
    expect(result.body).toEqual({ state: "verified", purchaseType: "one_time" });
    expect(Object.keys(result.body as object).sort()).toEqual([
      "purchaseType",
      "state",
    ]);
  });

  it.each(["active", "trialing"])("verifies a completed %s subscription", async (status) => {
    mocks.retrieveSession.mockResolvedValue(
      session({
        mode: "subscription",
        metadata: { userId: "user-current", purchaseType: "subscription" },
        subscription: { status },
      })
    );
    expect((await call()).result.body).toEqual({
      state: "verified",
      purchaseType: "subscription",
    });
  });

  it.each([
    { metadata: { userId: "user-current", purchaseType: "unsupported" } },
    {
      metadata: {
        userId: "user-current",
        purchaseType: "one_time",
        episodeId: "invented-ep99",
      },
    },
    {
      mode: "subscription",
      metadata: { userId: "user-current", purchaseType: "subscription" },
      subscription: { status: "canceled" },
    },
  ])("rejects unsupported checkout state %#", async (overrides) => {
    mocks.retrieveSession.mockResolvedValue(session(overrides));
    expect((await call()).result.statusCode).toBe(404);
  });

  it("hides Stripe lookup failures", async () => {
    mocks.retrieveSession.mockRejectedValue(new Error("raw customer details"));
    const { result } = await call();
    expect(result).toEqual({ statusCode: 404, body: { state: "invalid" } });
  });
});
