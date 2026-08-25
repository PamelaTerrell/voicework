import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profileResult: { data: null as unknown, error: null as unknown },
  retrieveCustomer: vi.fn(),
  listCustomers: vi.fn(),
  listSubscriptions: vi.fn(),
  upsertProfile: vi.fn(),
  updateProfile: vi.fn(),
  profileEq: vi.fn(),
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
      upsert: mocks.upsertProfile,
      update: mocks.updateProfile.mockImplementation(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }),
  },
}));

import { validateAuthenticatedMembership } from "../api/_membership.js";

const user = (email: string | undefined = "trusted") =>
  ({ id: "user-current", email }) as User;

const subscription = (overrides: Record<string, unknown> = {}) => ({
  status: "active",
  cancel_at_period_end: false,
  cancel_at: null,
  current_period_end: Math.floor(Date.now() / 1000) + 3600,
  ...overrides,
});

beforeEach(() => {
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
  mocks.upsertProfile.mockResolvedValue({ error: null });
});

describe("authenticated membership validation", () => {
  it.each([
    ["missing email", { id: "user-current" } as User],
    ["missing profile", user(), null],
    ["missing customer link", user(), { id: "user-current", stripe_customer_id: null }],
  ])("fails closed for %s", async (_name, currentUser, profile) => {
    if (profile !== undefined) mocks.profileResult = { data: profile, error: null };
    expect(await validateAuthenticatedMembership(currentUser)).toEqual({
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
    expect(await validateAuthenticatedMembership(user())).toEqual({
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
    expect(
      (await validateAuthenticatedMembership(user(), {
        reconcileByVerifiedEmail: true,
      })).active
    ).toBe(true);
    expect(mocks.upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-current" }),
      { onConflict: "id" }
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

  it("returns no customer, subscription, profile, or email identifiers", async () => {
    const result = await validateAuthenticatedMembership(user());
    expect(Object.keys(result).sort()).toEqual([
      "active",
      "cancellationEffectiveAt",
      "cancellationScheduled",
    ]);
  });
});
