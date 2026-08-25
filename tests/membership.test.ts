import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profileResult: { data: null as unknown, error: null as unknown },
  retrieveCustomer: vi.fn(),
  listCustomers: vi.fn(),
  listSubscriptions: vi.fn(),
  upsertProfile: vi.fn(),
  updateProfile: vi.fn(),
  updateProfileEq: vi.fn(),
  profileEq: vi.fn(),
  profileWriteResult: { data: null as unknown, error: null as unknown },
}));

vi.mock("../api/_lib.js", () => ({
  isActiveSub: (status?: string | null) =>
    status === "active" || status === "trialing",
  normalizeEmail: (value?: string | null) =>
    value?.trim().toLowerCase() ?? null,
  stripe: {
    customers: {
      retrieve: mocks.retrieveCustomer,
      list: mocks.listCustomers,
    },
    subscriptions: { list: mocks.listSubscriptions },
  },
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: mocks.profileEq.mockImplementation(() => ({
          maybeSingle: async () => mocks.profileResult,
        })),
      }),
      upsert: mocks.upsertProfile.mockImplementation(() => ({
        select: () => ({ maybeSingle: async () => mocks.profileWriteResult }),
      })),
      update: mocks.updateProfile.mockImplementation(() => ({
        eq: mocks.updateProfileEq.mockImplementation(() => ({
          select: () => ({ maybeSingle: async () => mocks.profileWriteResult }),
        })),
      })),
    }),
  },
}));

import {
  reconcileAuthenticatedMembership,
} from "../api/_membership.js";

const validateAuthenticatedMembership = reconcileAuthenticatedMembership;

const user = (email: string | undefined = "trusted") =>
  ({ id: "user-current", email }) as User;

const subscription = (overrides: Record<string, unknown> = {}) => ({
  customer: "customer-linked",
  status: "active",
  cancel_at_period_end: false,
  cancel_at: null,
  current_period_end: Math.floor(Date.now() / 1000) + 3600,
  ...overrides,
});

beforeEach(() => {
  for (const mock of [
    mocks.retrieveCustomer,
    mocks.listCustomers,
    mocks.listSubscriptions,
    mocks.upsertProfile,
    mocks.updateProfile,
    mocks.updateProfileEq,
    mocks.profileEq,
  ]) mock.mockReset();
  mocks.profileEq.mockImplementation(() => ({
    maybeSingle: async () => mocks.profileResult,
  }));
  mocks.updateProfile.mockImplementation(() => ({
    eq: mocks.updateProfileEq.mockImplementation(() => ({
      select: () => ({ maybeSingle: async () => mocks.profileWriteResult }),
    })),
  }));
  mocks.upsertProfile.mockImplementation(() => ({
    select: () => ({ maybeSingle: async () => mocks.profileWriteResult }),
  }));
  mocks.profileResult = {
    data: { id: "user-current", stripe_customer_id: "customer-linked" },
    error: null,
  };
  mocks.retrieveCustomer.mockResolvedValue({
    id: "customer-linked",
    email: "trusted",
  });
  mocks.listCustomers.mockResolvedValue({ data: [], has_more: false });
  mocks.listSubscriptions.mockResolvedValue({
    data: [subscription()],
    has_more: false,
  });
  mocks.profileWriteResult = { data: { id: "user-current" }, error: null };
});

describe("authenticated membership validation", () => {
  it.each([
    ["missing email", { id: "user-current" } as User],
    ["missing profile", user(), null],
    ["missing customer link", user(), { id: "user-current", stripe_customer_id: null }],
  ])("fails closed for %s", async (_name, currentUser, profile) => {
    if (profile !== undefined) mocks.profileResult = { data: profile, error: null };
    expect(await validateAuthenticatedMembership(currentUser)).toMatchObject({
      active: false,
      cancellationScheduled: false,
      cancellationEffectiveAt: null,
    });
  });

  it.each(["active", "trialing"])("accepts a matching %s subscription", async (status) => {
    mocks.listSubscriptions.mockResolvedValue({
      data: [subscription({ status })],
      has_more: false,
    });
    expect((await validateAuthenticatedMembership(user())).active).toBe(true);
    expect(mocks.profileEq).toHaveBeenCalledWith("id", "user-current");
  });

  it.each(["canceled", "past_due", "unpaid", "incomplete"])(
    "rejects %s subscriptions",
    async (status) => {
      mocks.listSubscriptions.mockResolvedValue({
        data: [subscription({ status })],
        has_more: false,
      });
      expect((await validateAuthenticatedMembership(user())).active).toBe(false);
    }
  );

  it("preserves access during a scheduled paid-through period", async () => {
    const paidThrough = Math.floor(Date.now() / 1000) + 3600;
    mocks.listSubscriptions.mockResolvedValue({
      data: [subscription({ cancel_at_period_end: true, current_period_end: paidThrough })],
      has_more: false,
    });
    expect(await validateAuthenticatedMembership(user())).toMatchObject({
      active: true,
      cancellationScheduled: true,
      cancellationEffectiveAt: paidThrough,
    });
  });

  it.each([
    subscription({ cancel_at_period_end: true, current_period_end: 1 }),
    subscription({ cancel_at_period_end: true, current_period_end: null }),
  ])("rejects expired or incomplete cancellation data", async (value) => {
    mocks.listSubscriptions.mockResolvedValue({ data: [value], has_more: false });
    expect((await validateAuthenticatedMembership(user())).active).toBe(false);
  });

  it("rejects mismatched and deleted customers", async () => {
    mocks.retrieveCustomer.mockResolvedValueOnce({ email: "different" });
    expect((await validateAuthenticatedMembership(user())).active).toBe(false);
    mocks.retrieveCustomer.mockResolvedValueOnce({ deleted: true, email: "trusted" });
    expect((await validateAuthenticatedMembership(user())).active).toBe(false);
  });

  it("rejects multiple active subscriptions and incomplete pagination", async () => {
    mocks.listSubscriptions.mockResolvedValueOnce({
      data: [subscription(), subscription()],
      has_more: false,
    });
    expect((await validateAuthenticatedMembership(user())).active).toBe(false);
    mocks.listSubscriptions.mockResolvedValueOnce({ data: [subscription()], has_more: true });
    expect((await validateAuthenticatedMembership(user())).active).toBe(false);
  });

  it("fails closed when Stripe or profile lookup fails", async () => {
    mocks.retrieveCustomer.mockRejectedValueOnce(new Error("lookup failed"));
    expect((await validateAuthenticatedMembership(user())).active).toBe(false);

    mocks.profileResult = { data: null, error: new Error("profile failed") };
    expect((await validateAuthenticatedMembership(user())).active).toBe(false);
  });

  it("reconciles exactly one trusted active returning member", async () => {
    mocks.profileResult = { data: null, error: null };
    mocks.listCustomers.mockResolvedValue({
      data: [{ id: "customer-returning", email: "trusted" }],
      has_more: false,
    });
    mocks.retrieveCustomer.mockResolvedValue({
      id: "customer-returning",
      email: "trusted",
    });
    mocks.listSubscriptions.mockResolvedValue({
      data: [subscription({ customer: "customer-returning" })],
      has_more: false,
    });
    expect(
      (await validateAuthenticatedMembership(user(), {
        reconcileByVerifiedEmail: true,
      })).active
    ).toBe(true);
    expect(mocks.upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-current" }),
      { onConflict: "id" },
    );
  });

  it("rejects ambiguous returning-member reconciliation", async () => {
    mocks.profileResult = { data: null, error: null };
    mocks.listCustomers.mockResolvedValue({
      data: [
        { id: "customer-a", email: "trusted" },
        { id: "customer-b", email: "trusted" },
      ],
      has_more: false,
    });
    expect(
      (await validateAuthenticatedMembership(user(), {
        reconcileByVerifiedEmail: true,
      })).active
    ).toBe(false);
  });

  it("keeps reconciliation-only fields out of the internal outcome", async () => {
    const result = await validateAuthenticatedMembership(user());
    expect(result).not.toHaveProperty("subscriptionStatus");
    expect(result).not.toHaveProperty("reconcile");
    expect(result).not.toHaveProperty("email");
  });

  it.each([
    ["inactive", { id: "customer-linked", email: "trusted" }, { data: [], has_more: false }],
    ["deleted", { id: "customer-linked", deleted: true }, null],
    ["email-mismatched", { id: "customer-linked", email: "different" }, null],
  ])("repairs an %s stored customer from exactly one trusted active candidate", async (_label, storedCustomer, storedSubscriptions) => {
    mocks.retrieveCustomer
      .mockResolvedValueOnce(storedCustomer)
      .mockResolvedValueOnce({ id: "customer-current", email: "trusted" });
    mocks.listCustomers.mockResolvedValue({
      data: [{ id: "customer-current", email: "trusted" }],
      has_more: false,
    });
    if (storedSubscriptions) mocks.listSubscriptions.mockResolvedValueOnce(storedSubscriptions);
    mocks.listSubscriptions.mockResolvedValueOnce({
      data: [subscription({ customer: "customer-current" })],
      has_more: false,
    });

    const result = await reconcileAuthenticatedMembership(user(), {
      reconcileByVerifiedEmail: true,
    });
    expect(result.outcome).toBe("active");
    expect(mocks.updateProfile).toHaveBeenCalledWith(expect.objectContaining({
      stripe_customer_id: "customer-current",
      is_subscriber: true,
      subscription_status: "active",
    }));
    expect(mocks.updateProfileEq).toHaveBeenCalledWith("id", "user-current");
  });

  it("fails unavailable when the scoped profile repair is not confirmed", async () => {
    mocks.retrieveCustomer
      .mockResolvedValueOnce({ id: "customer-linked", email: "trusted" })
      .mockResolvedValueOnce({ id: "customer-current", email: "trusted" });
    mocks.listSubscriptions
      .mockResolvedValueOnce({ data: [], has_more: false })
      .mockResolvedValueOnce({
        data: [subscription({ customer: "customer-current" })],
        has_more: false,
      });
    mocks.listCustomers.mockResolvedValue({
      data: [{ id: "customer-current", email: "trusted" }],
      has_more: false,
    });
    mocks.profileWriteResult = { data: null, error: new Error("write failed") };
    expect((await reconcileAuthenticatedMembership(user(), {
      reconcileByVerifiedEmail: true,
    })).outcome).toBe("unavailable");
  });

  it("accepts string and expanded subscription customer ownership", async () => {
    for (const customer of ["customer-linked", { id: "customer-linked" }]) {
      mocks.listSubscriptions.mockResolvedValue({
        data: [subscription({ customer })],
        has_more: false,
      });
      expect((await reconcileAuthenticatedMembership(user())).outcome).toBe("active");
    }
  });

  it.each([
    ["deleted expanded customer", { id: "customer-linked", deleted: true }],
    ["missing expanded ID", { email: "trusted" }],
    ["empty expanded ID", { id: "" }],
    ["malformed expanded ID", { id: 42 }],
    ["wrong expanded ID", { id: "customer-other" }],
    ["unfamiliar deleted marker", { id: "customer-linked", deleted: "yes" }],
  ])("fails closed for %s", async (_label, customer) => {
    mocks.listSubscriptions.mockResolvedValue({
      data: [subscription({ customer })],
      has_more: false,
    });
    expect((await reconcileAuthenticatedMembership(user(), {
      reconcileByVerifiedEmail: true,
    })).outcome).toBe("conflict");
    expect(mocks.listCustomers).not.toHaveBeenCalled();
  });

  it.each([
    ["pagination", { data: [subscription()], has_more: true }],
    ["malformed collection", { data: null, has_more: false }],
    ["ownership mismatch", { data: [subscription({ customer: "customer-other" })], has_more: false }],
    ["multiple active subscriptions", { data: [subscription(), subscription()], has_more: false }],
    ["invalid cancellation timing", { data: [subscription({ cancel_at_period_end: true, current_period_end: 1 })], has_more: false }],
  ])("does not reconcile after stored-customer %s", async (_label, result) => {
    mocks.listSubscriptions.mockResolvedValue(result);
    const outcome = await reconcileAuthenticatedMembership(user(), {
      reconcileByVerifiedEmail: true,
    });
    expect(outcome.outcome).toBe("conflict");
    expect(mocks.listCustomers).not.toHaveBeenCalled();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("does not reconcile after a stored-customer provider exception", async () => {
    mocks.retrieveCustomer.mockRejectedValue(new Error("provider unavailable"));
    expect((await reconcileAuthenticatedMembership(user(), {
      reconcileByVerifiedEmail: true,
    })).outcome).toBe("unavailable");
    expect(mocks.listCustomers).not.toHaveBeenCalled();
  });

  it("fails closed when a searched candidate returns a subscription owned by another customer", async () => {
    mocks.profileResult = { data: null, error: null };
    mocks.listCustomers.mockResolvedValue({
      data: [{ id: "customer-current", email: "trusted" }],
      has_more: false,
    });
    mocks.retrieveCustomer.mockResolvedValue({
      id: "customer-current",
      email: "trusted",
    });
    mocks.listSubscriptions.mockResolvedValue({
      data: [subscription({ customer: "customer-other" })],
      has_more: false,
    });
    expect((await reconcileAuthenticatedMembership(user(), {
      reconcileByVerifiedEmail: true,
    })).outcome).toBe("conflict");
    expect(mocks.upsertProfile).not.toHaveBeenCalled();
  });

  it.each([
    ["deleted", { id: "customer-bad", email: "trusted", deleted: true }],
    ["email-mismatched", { id: "customer-bad", email: "different" }],
    ["malformed", { email: "trusted" }],
  ])("does not reconcile one active candidate when another candidate is %s", async (_label, badCandidate) => {
    mocks.profileResult = { data: null, error: null };
    mocks.listCustomers.mockResolvedValue({
      data: [
        { id: "customer-current", email: "trusted" },
        badCandidate,
      ],
      has_more: false,
    });
    mocks.retrieveCustomer.mockResolvedValue({
      id: "customer-current",
      email: "trusted",
    });
    mocks.listSubscriptions.mockResolvedValue({
      data: [subscription({ customer: "customer-current" })],
      has_more: false,
    });
    expect((await reconcileAuthenticatedMembership(user(), {
      reconcileByVerifiedEmail: true,
    })).outcome).toBe("conflict");
    expect(mocks.upsertProfile).not.toHaveBeenCalled();
  });

  it("fails closed if a listed candidate becomes deleted when strictly retrieved", async () => {
    mocks.profileResult = { data: null, error: null };
    mocks.listCustomers.mockResolvedValue({
      data: [{ id: "customer-current", email: "trusted" }],
      has_more: false,
    });
    mocks.retrieveCustomer.mockResolvedValue({
      id: "customer-current",
      deleted: true,
    });
    expect((await reconcileAuthenticatedMembership(user(), {
      reconcileByVerifiedEmail: true,
    })).outcome).toBe("conflict");
    expect(mocks.upsertProfile).not.toHaveBeenCalled();
  });

  it("repairs exactly one verified inactive candidate with synchronized inactive fields", async () => {
    mocks.retrieveCustomer
      .mockResolvedValueOnce({ id: "customer-linked", deleted: true })
      .mockResolvedValueOnce({ id: "customer-inactive", email: "trusted" });
    mocks.listCustomers.mockResolvedValue({
      data: [{ id: "customer-inactive", email: "trusted" }],
      has_more: false,
    });
    mocks.listSubscriptions.mockResolvedValue({
      data: [subscription({ customer: "customer-inactive", status: "canceled" })],
      has_more: false,
    });
    const result = await reconcileAuthenticatedMembership(user(), {
      reconcileByVerifiedEmail: true,
    });
    expect(result).toMatchObject({
      outcome: "inactive",
      active: false,
      customerId: "customer-inactive",
    });
    expect(mocks.updateProfile).toHaveBeenCalledWith({
      email: "trusted",
      stripe_customer_id: "customer-inactive",
      is_subscriber: false,
      subscription_status: "inactive",
    });
    expect(mocks.updateProfileEq).toHaveBeenCalledWith("id", "user-current");
  });

  it("fails unavailable when an inactive-link repair is unconfirmed", async () => {
    mocks.retrieveCustomer
      .mockResolvedValueOnce({ id: "customer-linked", deleted: true })
      .mockResolvedValueOnce({ id: "customer-inactive", email: "trusted" });
    mocks.listCustomers.mockResolvedValue({
      data: [{ id: "customer-inactive", email: "trusted" }],
      has_more: false,
    });
    mocks.listSubscriptions.mockResolvedValue({
      data: [subscription({ customer: "customer-inactive", status: "canceled" })],
      has_more: false,
    });
    mocks.profileWriteResult = { data: null, error: null };
    expect((await reconcileAuthenticatedMembership(user(), {
      reconcileByVerifiedEmail: true,
    })).outcome).toBe("unavailable");
  });

  it("fails closed for customer-search pagination, zero matches, and multiple active matches", async () => {
    mocks.profileResult = { data: null, error: null };
    mocks.listCustomers.mockResolvedValueOnce({ data: [], has_more: true });
    expect((await reconcileAuthenticatedMembership(user(), { reconcileByVerifiedEmail: true })).outcome).toBe("conflict");

    mocks.listCustomers.mockResolvedValueOnce({ data: [], has_more: false });
    expect((await reconcileAuthenticatedMembership(user(), { reconcileByVerifiedEmail: true })).outcome).toBe("inactive");

    mocks.listCustomers.mockResolvedValueOnce({
      data: [
        { id: "customer-a", email: "trusted" },
        { id: "customer-b", email: "trusted" },
      ],
      has_more: false,
    });
    mocks.retrieveCustomer
      .mockResolvedValueOnce({ id: "customer-a", email: "trusted" })
      .mockResolvedValueOnce({ id: "customer-b", email: "trusted" });
    mocks.listSubscriptions
      .mockResolvedValueOnce({ data: [subscription({ customer: "customer-a" })], has_more: false })
      .mockResolvedValueOnce({ data: [subscription({ customer: "customer-b" })], has_more: false });
    expect((await reconcileAuthenticatedMembership(user(), { reconcileByVerifiedEmail: true })).outcome).toBe("conflict");
  });
});
