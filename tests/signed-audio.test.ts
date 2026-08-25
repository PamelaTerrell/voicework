import { beforeEach, describe, expect, it, vi } from "vitest";
import { authError, request, response } from "./helpers.js";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  validateMembership: vi.fn(),
  entitlementResult: { data: null as unknown, error: null as unknown },
  entitlementEq: vi.fn(),
  storageFrom: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("../api/_membership.js", () => ({
  reconcileAuthenticatedMembership: mocks.validateMembership,
}));

vi.mock("../api/_lib.js", () => ({
  requireUser: mocks.requireUser,
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: () => ({
        eq: mocks.entitlementEq.mockImplementation(() => ({
          eq: mocks.entitlementEq.mockImplementation(() => ({
            maybeSingle: async () => mocks.entitlementResult,
          })),
        })),
      }),
    })),
    storage: {
      from: mocks.storageFrom.mockImplementation(() => ({
        createSignedUrl: mocks.createSignedUrl,
      })),
    },
  },
}));

import signedAudio from "../api/signed-audio.js";

beforeEach(() => {
  mocks.requireUser.mockResolvedValue({ id: "user-current", email: "trusted" });
  mocks.validateMembership.mockResolvedValue({ outcome: "inactive", active: false });
  mocks.entitlementResult = { data: null, error: null };
  mocks.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "signed-result" },
    error: null,
  });
});

async function call(query: Record<string, string>) {
  const output = response();
  await signedAudio(request({ query }), output.res);
  expect(output.result.headers.get("cache-control")).toBe("no-store");
  expect(output.result.headers.get("vary")).toBe("Authorization");
  return output;
}

it("sets authenticated cache headers on unsupported methods", async () => {
  const output = response();
  await signedAudio(request({ method: "POST" }), output.res);
  expect(output.result.statusCode).toBe(405);
  expect(output.result.headers.get("cache-control")).toBe("no-store");
  expect(output.result.headers.get("vary")).toBe("Authorization");
});

describe("protected audio authorization", () => {
  it("rejects anonymous access", async () => {
    mocks.requireUser.mockRejectedValue(authError("Missing Authorization Bearer token"));
    const { result } = await call({ episodeId: "conversation-ep2" });
    expect(result.statusCode).toBe(401);
    expect(mocks.validateMembership).not.toHaveBeenCalled();
  });

  it("rejects unsupported IDs before entitlement or storage access", async () => {
    const { result } = await call({ episodeId: "invented-ep99" });
    expect(result.statusCode).toBe(404);
    expect(mocks.entitlementEq).not.toHaveBeenCalled();
    expect(mocks.storageFrom).not.toHaveBeenCalled();
  });

  it("denies a non-member protected full episode", async () => {
    const { result } = await call({ episodeId: "conversation-ep2" });
    expect(result.statusCode).toBe(403);
  });

  it.each(["conflict", "unavailable"])(
    "returns a generic 503 for %s membership without an entitlement",
    async (outcome) => {
      mocks.validateMembership.mockResolvedValue({ outcome, active: false });
      const { result } = await call({ episodeId: "conversation-ep2" });
      expect(result.statusCode).toBe(503);
      expect(result.body).toEqual({ error: "Unable to authorize audio." });
      expect(mocks.storageFrom).not.toHaveBeenCalled();
    },
  );

  it.each(["inactive", "conflict", "unavailable"])(
    "preserves an exact historical entitlement during %s membership",
    async (outcome) => {
      mocks.validateMembership.mockResolvedValue({ outcome, active: false });
      mocks.entitlementResult = { data: { id: "entitlement" }, error: null };
      const { result } = await call({ episodeId: "conversation-ep2" });
      expect(result.statusCode).toBe(200);
    },
  );

  it("does not require an entitlement for active membership", async () => {
    mocks.validateMembership.mockResolvedValue({ outcome: "active", active: true });
    const { result } = await call({ episodeId: "conversation-ep2" });
    expect(result.statusCode).toBe(200);
    expect(mocks.entitlementEq).not.toHaveBeenCalled();
  });

  it("allows a valid member and cancellation-period member", async () => {
    mocks.validateMembership.mockResolvedValue({
      active: true,
      cancellationScheduled: true,
      cancellationEffectiveAt: 9999999999,
    });
    const { result } = await call({ episodeId: "conversation-ep2" });
    expect(result.statusCode).toBe(200);
  });

  it("requires an exact entitlement for the authenticated user and episode", async () => {
    mocks.entitlementResult = { data: { id: "entitlement" }, error: null };
    let output = await call({ episodeId: "conversation-ep2" });
    expect(output.result.statusCode).toBe(200);
    expect(mocks.entitlementEq).toHaveBeenCalledWith("user_id", "user-current");
    expect(mocks.entitlementEq).toHaveBeenCalledWith(
      "episode_id",
      "conversation-ep2"
    );

    mocks.entitlementResult = { data: null, error: null };
    output = await call({ episodeId: "versions-ep5" });
    expect(output.result.statusCode).toBe(403);
  });

  it("never falls back from a missing preview to the full object", async () => {
    const { result } = await call({ episodeId: "conversation-ep2", type: "preview" });
    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual({ error: "Preview unavailable." });
    expect(mocks.storageFrom).not.toHaveBeenCalled();
  });

  it("allows an approved preview and episode 3 free-full under the signed-in policy", async () => {
    let output = await call({ episodeId: "replays-ep1", type: "preview" });
    expect(output.result.statusCode).toBe(200);
    expect(mocks.validateMembership).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-current", email: "trusted" });
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: "signed-result" }, error: null });
    output = await call({ episodeId: "say-sorry-ep3" });
    expect(output.result.statusCode).toBe(200);
    expect(mocks.validateMembership).not.toHaveBeenCalled();
  });

  it("uses a ten-minute URL lifetime and does not log tokens or URLs", async () => {
    mocks.validateMembership.mockResolvedValue({ active: true });
    const consoleSpy = vi.spyOn(console, "log");
    const { result } = await call({ episodeId: "versions-ep5" });
    expect(result.statusCode).toBe(200);
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      "versions-ep5/full.mp3",
      600
    );
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("hides storage paths and raw storage errors", async () => {
    mocks.validateMembership.mockResolvedValue({ active: true });
    mocks.createSignedUrl.mockResolvedValue({
      data: null,
      error: new Error("versions-ep5/full.mp3 internal failure"),
    });
    const { result } = await call({ episodeId: "versions-ep5" });
    expect(result.statusCode).toBe(404);
    expect(JSON.stringify(result.body)).not.toContain("full.mp3");
  });
});
