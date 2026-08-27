import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getConfirmationAuthView,
  initialVerificationState,
  isVerifiedCheckoutState,
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

  it("does not permit success analytics before server verification", () => {
    expect(isVerifiedCheckoutState("direct")).toBe(false);
    expect(isVerifiedCheckoutState("verifying")).toBe(false);
    expect(isVerifiedCheckoutState("pending")).toBe(false);
    expect(isVerifiedCheckoutState("invalid")).toBe(false);
    expect(isVerifiedCheckoutState("failure")).toBe(false);
    expect(isVerifiedCheckoutState("verified_subscription")).toBe(true);
    expect(isVerifiedCheckoutState("verified_one_time")).toBe(true);
  });
});

describe("checkout confirmation authentication presentation", () => {
  it("shows authenticated confirmation copy without a sign-in form", () => {
    expect(
      getConfirmationAuthView("verified_subscription", "authenticated"),
    ).toEqual({
      showAuthenticatedCopy: true,
      showAuthLoading: false,
      showSignInForm: false,
    });
  });

  it("keeps sign-in available when confirmation succeeds without a session", () => {
    expect(
      getConfirmationAuthView("verified_subscription", "signed_out"),
    ).toEqual({
      showAuthenticatedCopy: false,
      showAuthLoading: false,
      showSignInForm: true,
    });
  });

  it("suppresses the sign-in form while authentication is loading", () => {
    expect(
      getConfirmationAuthView("verified_subscription", "checking"),
    ).toEqual({
      showAuthenticatedCopy: false,
      showAuthLoading: true,
      showSignInForm: false,
    });
  });

  it.each(["failure", "invalid", "pending"] as const)(
    "preserves the sign-in recovery UI for %s",
    (state) => {
      expect(getConfirmationAuthView(state, "signed_out").showSignInForm).toBe(
        true,
      );
    },
  );
});

describe("Thanks page authentication integration", () => {
  const source = readFileSync(resolve("src/pages/Thanks.tsx"), "utf8");

  it("renders authenticated confirmation copy and gates the sign-in form", () => {
    expect(source).toContain(
      "Your membership is confirmed. Open the Night Listener library to start listening.",
    );
    expect(source).toContain("{authView.showSignInForm && (");
    expect(source).toContain("{authView.showAuthLoading && (");
    expect(source).toContain("Open Members Library");
  });

  it("uses the trusted default /members magic-link destination", () => {
    expect(source).toContain("await sendMagicLink(trimmedEmail)");
    expect(source).not.toContain("signInWithOtp");
    expect(source).not.toContain("window.location.origin");
  });

  it("retains checkout verification and its generic failure state", () => {
    expect(source).toContain('fetch(\n          `/api/checkout-session?session_id=');
    expect(source).toContain('setVerificationState("failure")');
    expect(source).toContain("clearSensitiveBrowserUrl()");
  });
});
