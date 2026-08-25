import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";
import {
  isActiveSub,
  normalizeEmail,
  requireUser,
  stripe,
  supabaseAdmin,
} from "./_lib.js";

function getRelevantSubscription(subscriptions: Stripe.Subscription[]) {
  return (
    subscriptions.find(
      (subscription) =>
        subscription.status === "active" ||
        subscription.status === "trialing" ||
        subscription.status === "past_due" ||
        subscription.status === "unpaid"
    ) ?? null
  );
}

async function findUniqueActiveCustomer(trustedEmail: string) {
  const customers = await stripe.customers.list({
    email: trustedEmail,
    limit: 10,
  });

  const matches: Array<{
    customerId: string;
    subscription: Stripe.Subscription;
  }> = [];

  for (const customer of customers.data) {
    if (normalizeEmail(customer.email) !== trustedEmail) continue;

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
    });

    const activeSubscription = subscriptions.data.find((subscription) =>
      isActiveSub(subscription.status)
    );

    if (activeSubscription) {
      matches.push({
        customerId: customer.id,
        subscription: activeSubscription,
      });
    }
  }

  return matches.length === 1 ? matches[0] : null;
}

function authenticationError(error: unknown) {
  if (!(error instanceof Error)) return null;

  const status = (error as Error & { status?: number }).status;
  if (status !== 401) return null;

  return error.message.includes("Missing Authorization")
    ? "Authentication required."
    : "Authentication expired or invalid.";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body =
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)
      : null;

  try {
    const user = await requireUser(req);

    if (
      req.query.email !== undefined ||
      req.query.userId !== undefined ||
      body?.email !== undefined ||
      body?.userId !== undefined
    ) {
      return res.status(400).json({
        error: "Identity parameters are not accepted.",
      });
    }

    const trustedEmail = normalizeEmail(user.email);

    if (!trustedEmail) {
      return res.status(400).json({
        error: "A verified account email is required.",
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, is_subscriber, subscription_status, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Unable to read authenticated membership profile.");
      return res.status(500).json({ error: "Unable to verify membership." });
    }

    const storedCustomerId = profile?.stripe_customer_id ?? null;
    let stripeCustomerId: string | null = null;
    let stripeSubscription: Stripe.Subscription | null = null;

    if (storedCustomerId) {
      const customer = await stripe.customers.retrieve(storedCustomerId);

      if (
        !("deleted" in customer && customer.deleted) &&
        normalizeEmail(customer.email) === trustedEmail
      ) {
        stripeCustomerId = storedCustomerId;
      }
    }

    if (stripeCustomerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 10,
      });

      stripeSubscription = getRelevantSubscription(subscriptions.data);
    }

    if (!stripeCustomerId) {
      const uniqueMatch = await findUniqueActiveCustomer(trustedEmail);

      if (uniqueMatch) {
        stripeCustomerId = uniqueMatch.customerId;
        stripeSubscription = uniqueMatch.subscription;

        const { error: linkError } = await supabaseAdmin.from("profiles").upsert(
          {
            id: user.id,
            email: trustedEmail,
            stripe_customer_id: stripeCustomerId,
            is_subscriber: true,
            subscription_status: stripeSubscription.status,
          },
          { onConflict: "id" }
        );

        if (linkError) {
          console.error("Unable to link authenticated membership profile.");
          return res.status(500).json({ error: "Unable to verify membership." });
        }
      }
    }

    const isSubscriber = stripeCustomerId
      ? isActiveSub(stripeSubscription?.status)
      : storedCustomerId
        ? false
        : !!profile?.is_subscriber || isActiveSub(profile?.subscription_status);

    if (profile && stripeCustomerId) {
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          email: trustedEmail,
          is_subscriber: isSubscriber,
          subscription_status: stripeSubscription?.status ?? "inactive",
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Unable to refresh authenticated membership profile.");
        return res.status(500).json({ error: "Unable to verify membership." });
      }
    }

    if (profile && storedCustomerId && !stripeCustomerId) {
      const { error: invalidLinkError } = await supabaseAdmin
        .from("profiles")
        .update({
          is_subscriber: false,
          subscription_status: "inactive",
        })
        .eq("id", user.id);

      if (invalidLinkError) {
        console.error("Unable to disable an invalid membership link.");
        return res.status(500).json({ error: "Unable to verify membership." });
      }
    }

    if (!isSubscriber) {
      return res.status(200).json({
        ok: true,
        isSubscriber: false,
        membershipStatus: "inactive",
        cancellationScheduled: false,
        cancellationEffectiveAt: null,
      });
    }

    return res.status(200).json({
      ok: true,
      isSubscriber: true,
      membershipStatus: "active",
      cancellationScheduled: !!stripeSubscription?.cancel_at_period_end,
      cancellationEffectiveAt:
        stripeSubscription?.cancel_at ??
        stripeSubscription?.current_period_end ??
        null,
    });
  } catch (error: unknown) {
    const authMessage = authenticationError(error);

    if (authMessage) {
      return res.status(401).json({ error: authMessage });
    }

    console.error("Unable to verify authenticated membership.");
    return res.status(500).json({ error: "Unable to verify membership." });
  }
}
