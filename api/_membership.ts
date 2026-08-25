import type { User } from "@supabase/supabase-js";
import {
  isActiveSub,
  normalizeEmail,
  stripe,
  supabaseAdmin,
} from "./_lib.js";

export type MembershipValidation = {
  active: boolean;
  cancellationScheduled: boolean;
  cancellationEffectiveAt: number | null;
};

type CustomerValidation = MembershipValidation & {
  customerId: string | null;
  subscriptionStatus: string | null;
  identityConflict: boolean;
};

const INACTIVE_MEMBERSHIP: MembershipValidation = {
  active: false,
  cancellationScheduled: false,
  cancellationEffectiveAt: null,
};

function inactiveCustomerValidation(
  identityConflict = false
): CustomerValidation {
  return {
    ...INACTIVE_MEMBERSHIP,
    customerId: null,
    subscriptionStatus: null,
    identityConflict,
  };
}

async function validateCustomerMembership(
  customerId: string,
  trustedEmail: string
): Promise<CustomerValidation> {
  const customer = await stripe.customers.retrieve(customerId);

  if (
    ("deleted" in customer && customer.deleted) ||
    normalizeEmail(customer.email) !== trustedEmail
  ) {
    return inactiveCustomerValidation(true);
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  if (subscriptions.has_more) return inactiveCustomerValidation();

  const activeSubscriptions = subscriptions.data.filter((subscription) =>
    isActiveSub(subscription.status)
  );

  if (activeSubscriptions.length !== 1) {
    return inactiveCustomerValidation();
  }

  const subscription = activeSubscriptions[0];
  const cancellationScheduled =
    subscription.cancel_at_period_end || subscription.cancel_at !== null;
  const cancellationEffectiveAt = cancellationScheduled
    ? subscription.cancel_at ?? subscription.current_period_end ?? null
    : null;

  if (
    cancellationScheduled &&
    (!cancellationEffectiveAt || cancellationEffectiveAt <= Date.now() / 1000)
  ) {
    return inactiveCustomerValidation();
  }

  return {
    active: true,
    cancellationScheduled,
    cancellationEffectiveAt,
    customerId,
    subscriptionStatus: subscription.status,
    identityConflict: false,
  };
}

async function findUniqueActiveCustomer(
  trustedEmail: string
): Promise<CustomerValidation> {
  const customers = await stripe.customers.list({
    email: trustedEmail,
    limit: 10,
  });

  if (customers.has_more) return inactiveCustomerValidation();

  const matches: CustomerValidation[] = [];

  for (const customer of customers.data) {
    if (normalizeEmail(customer.email) !== trustedEmail) continue;

    const validation = await validateCustomerMembership(
      customer.id,
      trustedEmail
    );

    if (validation.active) matches.push(validation);
  }

  return matches.length === 1 ? matches[0] : inactiveCustomerValidation();
}

async function validateMembership(
  user: User,
  options: { reconcileByVerifiedEmail?: boolean } = {}
): Promise<MembershipValidation> {
  const trustedEmail = normalizeEmail(user.email);
  if (!trustedEmail) return INACTIVE_MEMBERSHIP;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return INACTIVE_MEMBERSHIP;

  if (!profile) {
    if (!options.reconcileByVerifiedEmail) return INACTIVE_MEMBERSHIP;

    const validation = await findUniqueActiveCustomer(trustedEmail);
    if (!validation.active || !validation.customerId) {
      return INACTIVE_MEMBERSHIP;
    }

    const { error: insertError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: user.id,
        email: trustedEmail,
        stripe_customer_id: validation.customerId,
        is_subscriber: true,
        subscription_status: validation.subscriptionStatus,
      },
      { onConflict: "id" }
    );

    if (insertError) return INACTIVE_MEMBERSHIP;

    return {
      active: true,
      cancellationScheduled: validation.cancellationScheduled,
      cancellationEffectiveAt: validation.cancellationEffectiveAt,
    };
  }

  let validation = profile.stripe_customer_id
    ? await validateCustomerMembership(
        profile.stripe_customer_id,
        trustedEmail
      )
    : inactiveCustomerValidation();

  if (validation.identityConflict) return INACTIVE_MEMBERSHIP;

  if (!profile.stripe_customer_id && options.reconcileByVerifiedEmail) {
    validation = await findUniqueActiveCustomer(trustedEmail);

    if (validation.active && validation.customerId) {
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          email: trustedEmail,
          stripe_customer_id: validation.customerId,
          is_subscriber: true,
          subscription_status: validation.subscriptionStatus,
        })
        .eq("id", user.id);

      if (updateError) return INACTIVE_MEMBERSHIP;
    }
  }

  return {
    active: validation.active,
    cancellationScheduled: validation.cancellationScheduled,
    cancellationEffectiveAt: validation.cancellationEffectiveAt,
  };
}

export async function validateAuthenticatedMembership(
  user: User,
  options: { reconcileByVerifiedEmail?: boolean } = {}
): Promise<MembershipValidation> {
  try {
    return await validateMembership(user, options);
  } catch {
    return INACTIVE_MEMBERSHIP;
  }
}
