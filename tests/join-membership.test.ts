import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  getJoinMembershipView,
  parseMemberAccessState,
  verifyJoinMembership,
  type JoinMembershipState,
} from "../src/lib/joinMembership.js";
import { shouldShowHeaderInlineAuth } from "../src/lib/headerAuthVisibility.js";

const views: Record<
  JoinMembershipState,
  ReturnType<typeof getJoinMembershipView>
> = {
  signed_out: {
    showMagicLink: true,
    showChecking: false,
    showCheckout: false,
    showMembersLibrary: false,
    showVerificationError: false,
  },
  checking: {
    showMagicLink: false,
    showChecking: true,
    showCheckout: false,
    showMembersLibrary: false,
    showVerificationError: false,
  },
  active: {
    showMagicLink: false,
    showChecking: false,
    showCheckout: false,
    showMembersLibrary: true,
    showVerificationError: false,
  },
  inactive: {
    showMagicLink: false,
    showChecking: false,
    showCheckout: true,
    showMembersLibrary: false,
    showVerificationError: false,
  },
  verification_error: {
    showMagicLink: false,
    showChecking: false,
    showCheckout: false,
    showMembersLibrary: false,
    showVerificationError: true,
  },
};

describe("Join membership presentation", () => {
  it.each(Object.entries(views))(
    "shows only the intended controls for %s",
    (state, expected) => {
      expect(getJoinMembershipView(state as JoinMembershipState)).toEqual(
        expected,
      );
    },
  );

  it("never presents checking or verification errors as confirmed inactivity", () => {
    expect(getJoinMembershipView("checking").showCheckout).toBe(false);
    expect(getJoinMembershipView("verification_error").showCheckout).toBe(
      false,
    );
  });
});

describe("member-access contract parsing", () => {
  it("accepts only the exact active response", () => {
    expect(
      parseMemberAccessState(true, {
        ok: true,
        isSubscriber: true,
        membershipStatus: "active",
      }),
    ).toBe("active");
  });

  it("accepts only the exact inactive response", () => {
    expect(
      parseMemberAccessState(true, {
        ok: true,
        isSubscriber: false,
        membershipStatus: "inactive",
      }),
    ).toBe("inactive");
  });

  it.each([
    [false, { ok: true, isSubscriber: false, membershipStatus: "inactive" }],
    [true, { ok: false, isSubscriber: false, membershipStatus: "inactive" }],
    [true, { ok: true, isSubscriber: true, membershipStatus: "inactive" }],
    [true, { ok: true, isSubscriber: false, membershipStatus: "active" }],
    [true, null],
  ])("fails closed for an invalid response %#", (responseOk, payload) => {
    expect(parseMemberAccessState(responseOk, payload)).toBe(
      "verification_error",
    );
  });

  it("uses the authenticated member-access endpoint", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        isSubscriber: false,
        membershipStatus: "inactive",
      }),
    });

    await expect(verifyJoinMembership("access-token", request)).resolves.toBe(
      "inactive",
    );
    expect(request).toHaveBeenCalledWith("/api/member-access", {
      headers: { Authorization: "Bearer access-token" },
    });
  });

  it("fails closed when member-access cannot be verified", async () => {
    const request = vi.fn().mockRejectedValue(new Error("unavailable"));
    await expect(verifyJoinMembership("access-token", request)).resolves.toBe(
      "verification_error",
    );
  });
});

describe("Join page integration", () => {
  const source = readFileSync(resolve("src/pages/Join.tsx"), "utf8");
  const layoutSource = readFileSync(
    resolve("src/components/layout/SiteLayout.tsx"),
    "utf8",
  );

  it("contains the exact state-specific messages and CTA labels", () => {
    expect(source).toContain(
      "Sign in first, then continue to secure checkout.",
    );
    expect(source).toContain("Checking your membership…");
    expect(source).toContain("Join Night Listener — $4.99/month");
    expect(source).toContain("Your membership is active");
    expect(source).toContain("Open Members Library");
    expect(source).toContain("Retry membership check");
  });

  it("gates checkout and member-library actions on verified states", () => {
    expect(source).toContain("{membershipView.showCheckout && (");
    expect(source).toContain("{membershipView.showMembersLibrary && (");
    expect(source.match(/Open Members Library/g)).toHaveLength(1);
    expect(source).toContain('membershipState !== "inactive"');
  });

  it("removes the Night List and Formspree signup", () => {
    expect(source).not.toContain("Free Night List");
    expect(source).not.toContain("Want to hear when something new arrives?");
    expect(source).not.toContain("formspree.io");
    expect(source).not.toContain("FORM_ENDPOINT");
    expect(source).not.toContain('id="night-list-email"');
  });

  it("keeps the Join page magic-link form", () => {
    expect(source).toContain('htmlFor="member-email"');
    expect(source).toContain('id="member-email"');
    expect(source).toContain('sendMagicLink(email, "/join")');
    expect(source).toContain("Send magic link");
    expect(source).toContain(
      "Magic link sent. Check your email to continue.",
    );
    expect(source).not.toContain(
      "use the same address you used for membership",
    );
  });

  it("suppresses only the header's signed-out auth form on Join", () => {
    expect(shouldShowHeaderInlineAuth("/join")).toBe(false);
    expect(shouldShowHeaderInlineAuth("/join/")).toBe(false);
    expect(shouldShowHeaderInlineAuth("/")).toBe(true);
    expect(shouldShowHeaderInlineAuth("/listen")).toBe(true);
    expect(shouldShowHeaderInlineAuth("/members")).toBe(true);
    expect(layoutSource).toContain("{showHeaderInlineAuth && (");
    expect(layoutSource).toContain("<Auth />");
    expect(layoutSource).toContain("Unlock Membership");
  });

  it("preserves the authenticated subscription Checkout contract", () => {
    expect(source).toContain('fetch("/api/checkout"');
    expect(source).toContain('method: "POST"');
    expect(source).toContain("Authorization: `Bearer ${token}`");
    expect(source).toContain(
      'body: JSON.stringify({ mode: "subscription" })',
    );
    expect(source).toContain("window.location.assign(result.url)");
  });

  it("does not infer membership from browser-readable profile fields", () => {
    expect(source).toContain("verifyJoinMembership(session.access_token)");
    expect(source).not.toContain('.from("profiles")');
    expect(source).not.toContain("is_subscriber");
  });
});
