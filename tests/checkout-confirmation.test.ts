import { describe, expect, it } from "vitest";
import {
  initialVerificationState,
  resolveVerificationState,
  type VerificationState,
} from "../src/lib/checkoutConfirmation.js";

describe("checkout confirmation state selection", () => {
  it("selects direct and verifying initial states", () => {
    expect(initialVerificationState(null)).toBe("direct");
    expect(initialVerificationState("session-present")).toBe("verifying");
  });

  it.each<[boolean, Record<string, string>, VerificationState]>([
    [true, { state: "verified", purchaseType: "subscription" }, "verified_subscription"],
    [true, { state: "verified", purchaseType: "one_time" }, "verified_one_time"],
    [true, { state: "pending", purchaseType: "subscription" }, "pending"],
    [true, { state: "failed", purchaseType: "one_time" }, "invalid"],
    [false, { state: "verified", purchaseType: "subscription" }, "invalid"],
    [true, { state: "invalid" }, "invalid"],
  ])("maps server result %# to %s", (ok, result, expected) => {
    expect(resolveVerificationState(ok, result)).toBe(expected);
  });

  it("retains an explicit verification-failure state for request exceptions", () => {
    const failure: VerificationState = "failure";
    expect(failure).toBe("failure");
  });
});
