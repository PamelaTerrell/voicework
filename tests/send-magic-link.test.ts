import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithOtp: mocks.signInWithOtp,
    },
  },
}));

import {
  getMagicLinkRedirectTo,
  sendMagicLink,
  type MagicLinkDestination,
} from "../src/lib/sendMagicLink.js";

beforeEach(() => {
  mocks.signInWithOtp.mockReset();
  mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  vi.stubGlobal("window", {
    location: { hostname: "www.stabileusa.com" },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("magic-link destination policy", () => {
  it("preserves /members as the default destination", async () => {
    await sendMagicLink("listener@example.com");

    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "listener@example.com",
      options: {
        emailRedirectTo:
          "https://www.stabileusa.com/auth/callback?next=/members",
      },
    });
  });

  it("allows the Join flow to request only the trusted /join destination", async () => {
    await sendMagicLink("listener@example.com", "/join");

    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "listener@example.com",
      options: {
        emailRedirectTo:
          "https://www.stabileusa.com/auth/callback?next=/join",
      },
    });
  });

  it("falls back to /members for an untrusted runtime value", () => {
    expect(
      getMagicLinkRedirectTo(
        "www.stabileusa.com",
        "https://attacker.invalid" as MagicLinkDestination,
      ),
    ).toBe("https://www.stabileusa.com/auth/callback?next=/members");
  });

  it("uses only the trusted localhost and production callback origins", () => {
    expect(getMagicLinkRedirectTo("localhost", "/join")).toBe(
      "http://localhost:5173/auth/callback?next=/join",
    );
    expect(getMagicLinkRedirectTo("www.stabileusa.com", "/join")).toBe(
      "https://www.stabileusa.com/auth/callback?next=/join",
    );
    expect(getMagicLinkRedirectTo("preview.example", "/join")).toBe(
      "https://www.stabileusa.com/auth/callback?next=/join",
    );
  });
});
