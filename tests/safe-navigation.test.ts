import { describe, expect, it } from "vitest";
import {
  removeSensitiveUrlParameters,
  resolveAuthDestination,
  sanitizedPathname,
} from "../src/lib/safeNavigation.js";

describe("authentication redirect policy", () => {
  it("accepts every approved internal destination", () => {
    expect(resolveAuthDestination("/members")).toBe("/members");
    expect(resolveAuthDestination(["/members"])).toBe("/members");
  });

  it.each([
    null,
    undefined,
    "",
    "https://example.com",
    "//example.com",
    "%2F%2Fexample.com",
    "/\\example.com",
    "/members/../auth/callback",
    "/auth/callback",
    "/members?next=https://example.com",
  ])("falls back for missing or unsafe destination %#", (value) => {
    expect(resolveAuthDestination(value)).toBe("/members");
  });

  it("rejects repeated destination parameters", () => {
    expect(resolveAuthDestination(["/listen", "/join"])).toBe("/members");
  });
});

describe("sensitive URL cleanup", () => {
  it("removes authentication and checkout values plus URL hashes", () => {
    expect(
      removeSensitiveUrlParameters(
        "https://stabileusa.com/auth/callback?code=secret&next=%2Fmembers#access_token=secret",
      ),
    ).toBe("/auth/callback?next=%2Fmembers");
    expect(
      removeSensitiveUrlParameters("https://stabileusa.com/thanks?session_id=secret"),
    ).toBe("/thanks");
  });

  it("provides pathname-only analytics values", () => {
    expect(sanitizedPathname("https://stabileusa.com/thanks?session_id=secret#token"))
      .toBe("/thanks");
  });
});
