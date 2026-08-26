import type { User } from "@supabase/supabase-js";
import { isActiveSub, normalizeEmail, stripe, supabaseAdmin } from "./_lib.js";

type MembershipValidation = {
  active: boolean;
  cancellationScheduled: boolean;
  cancellationEffectiveAt: number | null;
};

export const MEMBERSHIP_DENIAL_REASONS = [
  "profile_lookup_failed",
  "stored_customer_retrieval_failed",
  "stored_customer_malformed",
  "stored_customer_identity_conflict",
  "customer_search_failed",
  "customer_search_paginated",
  "candidate_customer_invalid",
  "candidate_customer_ambiguous",
  "subscription_list_failed",
  "subscription_list_paginated",
  "subscription_malformed",
  "subscription_ownership_conflict",
  "subscription_status_unknown",
  "multiple_current_subscriptions",
  "cancellation_timing_invalid",
  "profile_repair_failed",
  "unexpected_failure",
] as const;

export type MembershipDenialReason = typeof MEMBERSHIP_DENIAL_REASONS[number];

export type TrustedMembershipOutcome = MembershipValidation & {
  outcome: "active" | "inactive" | "conflict" | "unavailable";
  customerId: string | null;
  reason: MembershipDenialReason | null;
};

type CustomerValidation = TrustedMembershipOutcome & {
  subscriptionStatus: string | null;
  reconcile: boolean;
};

const KNOWN_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
  "incomplete_expired",
  "canceled",
]);

const inactive = (
  outcome: TrustedMembershipOutcome["outcome"] = "inactive",
  customerId: string | null = null,
  reason: MembershipDenialReason | null = null,
): TrustedMembershipOutcome => ({
  outcome,
  active: false,
  cancellationScheduled: false,
  cancellationEffectiveAt: null,
  customerId,
  reason,
});

const membershipOutcome = (
  validation: CustomerValidation,
): TrustedMembershipOutcome => ({
  outcome: validation.outcome,
  active: validation.active,
  cancellationScheduled: validation.cancellationScheduled,
  cancellationEffectiveAt: validation.cancellationEffectiveAt,
  customerId: validation.customerId,
  reason: validation.reason,
});

export function logMembershipVerificationDenied(
  endpoint: "member-access" | "signed-audio",
  membership: TrustedMembershipOutcome,
) {
  if (
    (membership.outcome !== "conflict" && membership.outcome !== "unavailable") ||
    !membership.reason
  ) return;

  console.warn({
    event: "membership_verification_denied",
    endpoint,
    outcome: membership.outcome,
    reason: membership.reason,
  });
}

function customerIdFromSubscription(subscription: { customer?: unknown }) {
  if (typeof subscription.customer === "string") {
    return subscription.customer.length > 0 ? subscription.customer : null;
  }
  if (!subscription.customer || typeof subscription.customer !== "object") return null;
  if (!("id" in subscription.customer)) return null;
  if (typeof subscription.customer.id !== "string" || subscription.customer.id.length === 0) {
    return null;
  }
  if (
    "deleted" in subscription.customer &&
    (typeof subscription.customer.deleted !== "boolean" || subscription.customer.deleted)
  ) return null;
  return subscription.customer.id;
}

async function validateCustomerMembership(
  customerId: string,
  trustedEmail: string,
  allowStaleIdentity = false,
): Promise<CustomerValidation> {
  let customer;
  try {
    customer = await stripe.customers.retrieve(customerId);
  } catch {
    return {
      ...inactive(
        "unavailable",
        null,
        allowStaleIdentity
          ? "stored_customer_retrieval_failed"
          : "customer_search_failed",
      ),
      subscriptionStatus: null,
      reconcile: false,
    };
  }
  if (!customer || typeof customer !== "object") {
    return {
      ...inactive(
        "conflict",
        null,
        allowStaleIdentity ? "stored_customer_malformed" : "candidate_customer_invalid",
      ),
      subscriptionStatus: null,
      reconcile: false,
    };
  }
  if ("deleted" in customer && customer.deleted) {
    return allowStaleIdentity
      ? { ...inactive(), subscriptionStatus: null, reconcile: true }
      : { ...inactive("conflict", null, "candidate_customer_invalid"), subscriptionStatus: null, reconcile: false };
  }
  if (!("id" in customer) || customer.id !== customerId) {
    return { ...inactive("conflict", null, allowStaleIdentity ? "stored_customer_malformed" : "candidate_customer_invalid"), subscriptionStatus: null, reconcile: false };
  }
  if (normalizeEmail(customer.email) !== trustedEmail) {
    return allowStaleIdentity
      ? { ...inactive(), subscriptionStatus: null, reconcile: true }
      : { ...inactive("conflict", null, "candidate_customer_invalid"), subscriptionStatus: null, reconcile: false };
  }

  let subscriptions;
  try {
    subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });
  } catch {
    return { ...inactive("unavailable", null, "subscription_list_failed"), subscriptionStatus: null, reconcile: false };
  }
  if (!Array.isArray(subscriptions.data)) {
    return { ...inactive("conflict", null, "subscription_malformed"), subscriptionStatus: null, reconcile: false };
  }
  if (subscriptions.has_more !== false) {
    return { ...inactive("conflict", null, "subscription_list_paginated"), subscriptionStatus: null, reconcile: false };
  }
  for (const subscription of subscriptions.data) {
    if (
      !subscription ||
      typeof subscription !== "object" ||
      typeof subscription.cancel_at_period_end !== "boolean" ||
      (subscription.cancel_at !== null && typeof subscription.cancel_at !== "number") ||
      typeof subscription.current_period_end !== "number"
    ) {
      return { ...inactive("conflict", null, "subscription_malformed"), subscriptionStatus: null, reconcile: false };
    }
    if (customerIdFromSubscription(subscription) !== customerId) {
      return { ...inactive("conflict", null, "subscription_ownership_conflict"), subscriptionStatus: null, reconcile: false };
    }
    if (
      typeof subscription.status !== "string" ||
      !KNOWN_SUBSCRIPTION_STATUSES.has(subscription.status)
    ) {
      return { ...inactive("conflict", null, "subscription_status_unknown"), subscriptionStatus: null, reconcile: false };
    }
  }

  const activeSubscriptions = subscriptions.data.filter((subscription) =>
    isActiveSub(subscription.status),
  );
  if (activeSubscriptions.length > 1) {
    return { ...inactive("conflict", null, "multiple_current_subscriptions"), subscriptionStatus: null, reconcile: false };
  }
  if (activeSubscriptions.length === 0) {
    return {
      ...inactive("inactive", customerId),
      subscriptionStatus: null,
      reconcile: true,
    };
  }

  const subscription = activeSubscriptions[0];
  const cancellationScheduled =
    subscription.cancel_at_period_end === true || subscription.cancel_at !== null;
  const cancellationEffectiveAt = cancellationScheduled
    ? subscription.cancel_at ?? subscription.current_period_end ?? null
    : null;
  if (
    cancellationScheduled &&
    (!cancellationEffectiveAt || cancellationEffectiveAt <= Date.now() / 1000)
  ) {
    return { ...inactive("conflict", null, "cancellation_timing_invalid"), subscriptionStatus: null, reconcile: false };
  }

  return {
    outcome: "active",
    active: true,
    cancellationScheduled,
    cancellationEffectiveAt,
    customerId,
    subscriptionStatus: subscription.status,
    reconcile: false,
    reason: null,
  };
}

async function findUniqueActiveCustomer(
  trustedEmail: string,
): Promise<CustomerValidation> {
  let customers;
  try {
    customers = await stripe.customers.list({ email: trustedEmail, limit: 100 });
  } catch {
    return { ...inactive("unavailable", null, "customer_search_failed"), subscriptionStatus: null, reconcile: false };
  }
  if (!Array.isArray(customers.data)) {
    return { ...inactive("conflict", null, "candidate_customer_invalid"), subscriptionStatus: null, reconcile: false };
  }
  if (customers.has_more !== false) {
    return { ...inactive("conflict", null, "customer_search_paginated"), subscriptionStatus: null, reconcile: false };
  }

  const matches: CustomerValidation[] = [];
  const inactiveCustomers: CustomerValidation[] = [];
  for (const customer of customers.data) {
    if (!customer || typeof customer !== "object" || typeof customer.id !== "string") {
      return { ...inactive("conflict", null, "candidate_customer_invalid"), subscriptionStatus: null, reconcile: false };
    }
    if (("deleted" in customer && customer.deleted) || normalizeEmail(customer.email) !== trustedEmail) {
      return { ...inactive("conflict", null, "candidate_customer_invalid"), subscriptionStatus: null, reconcile: false };
    }
    const validation = await validateCustomerMembership(customer.id, trustedEmail);
    if (validation.outcome === "conflict" || validation.outcome === "unavailable") {
      return validation;
    }
    if (validation.active) matches.push(validation);
    else if (validation.customerId) inactiveCustomers.push(validation);
  }

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    return { ...inactive("conflict", null, "candidate_customer_ambiguous"), subscriptionStatus: null, reconcile: false };
  }
  if (inactiveCustomers.length === 1) return inactiveCustomers[0];
  if (inactiveCustomers.length > 1) {
    return { ...inactive("conflict", null, "candidate_customer_ambiguous"), subscriptionStatus: null, reconcile: false };
  }
  return { ...inactive(), subscriptionStatus: null, reconcile: false };
}

async function writeReconciledProfile(
  userId: string,
  trustedEmail: string,
  validation: CustomerValidation,
  profileExists: boolean,
) {
  const values = {
    email: trustedEmail,
    stripe_customer_id: validation.customerId,
    is_subscriber: validation.active,
    subscription_status: validation.active
      ? validation.subscriptionStatus
      : "inactive",
  };
  const query = profileExists
    ? supabaseAdmin.from("profiles").update(values).eq("id", userId)
    : supabaseAdmin.from("profiles").upsert(
        { id: userId, ...values },
        { onConflict: "id" },
      );
  const result = await query.select("id").maybeSingle();
  return !result.error && result.data?.id === userId;
}

export async function reconcileAuthenticatedMembership(
  user: User,
  options: { reconcileByVerifiedEmail?: boolean } = {},
): Promise<TrustedMembershipOutcome> {
  try {
    const trustedEmail = normalizeEmail(user.email);
    if (!trustedEmail) return inactive("conflict", null, "stored_customer_identity_conflict");

    let profileResult;
    try {
      profileResult = await supabaseAdmin
        .from("profiles")
        .select("id, stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();
    } catch {
      return inactive("unavailable", null, "profile_lookup_failed");
    }
    const { data: profile, error: profileError } = profileResult;
    if (profileError) return inactive("unavailable", null, "profile_lookup_failed");
    if (profile && profile.id !== user.id) return inactive("conflict", null, "stored_customer_identity_conflict");

    if (
      profile?.stripe_customer_id !== null &&
      profile?.stripe_customer_id !== undefined &&
      typeof profile.stripe_customer_id !== "string"
    ) return inactive("conflict", null, "stored_customer_malformed");

    const stored: CustomerValidation = profile?.stripe_customer_id
      ? await validateCustomerMembership(
          profile.stripe_customer_id,
          trustedEmail,
          true,
        )
      : { ...inactive(), subscriptionStatus: null, reconcile: true };
    if (stored.active) return membershipOutcome(stored);
    if (stored.outcome === "conflict" || stored.outcome === "unavailable") {
      return membershipOutcome(stored);
    }
    if (!options.reconcileByVerifiedEmail || !stored.reconcile) {
      return membershipOutcome(stored);
    }

    const candidate = await findUniqueActiveCustomer(trustedEmail);
    if (!candidate.customerId) {
      return membershipOutcome(candidate);
    }
    let repaired = false;
    try {
      repaired = await writeReconciledProfile(user.id, trustedEmail, candidate, Boolean(profile));
    } catch {
      return inactive("unavailable", null, "profile_repair_failed");
    }
    if (!repaired) {
      return inactive("unavailable", null, "profile_repair_failed");
    }
    return membershipOutcome(candidate);
  } catch {
    return inactive("unavailable", null, "unexpected_failure");
  }
}
