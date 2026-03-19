import type { VercelRequest, VercelResponse } from "@vercel/node";
import { stripe, supabaseAdmin } from "./_lib.js";

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? null;
}

function isActiveStatus(status?: string | null) {
  return status === "active" || status === "trialing";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const email = normalizeEmail(
      typeof req.query.email === "string" ? req.query.email : null
    );

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, is_subscriber, subscription_status, stripe_customer_id")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    let stripeCustomerId = profile?.stripe_customer_id ?? null;

    // Fallback: if no Stripe customer is linked yet, look one up by email.
    if (!stripeCustomerId) {
      const customers = await stripe.customers.list({
        email,
        limit: 10,
      });

      const matchingCustomer =
        customers.data.find((c) => normalizeEmail(c.email) === email) ?? null;

      if (matchingCustomer) {
        stripeCustomerId = matchingCustomer.id;

        // Backfill the profile so future checks are fast and stable.
        if (profile?.id) {
          const { error: updateErr } = await supabaseAdmin
            .from("profiles")
            .update({
              stripe_customer_id: stripeCustomerId,
            })
            .eq("id", profile.id);

          if (updateErr) {
            console.error("Failed to backfill stripe_customer_id:", updateErr);
          }
        }
      }
    }

    let stripeSubscription: {
      id: string;
      status: string;
      cancel_at_period_end: boolean;
      cancel_at: number | null;
      current_period_end: number | null;
    } | null = null;

    if (stripeCustomerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 10,
      });

      const relevantSub =
        subscriptions.data.find(
          (sub) =>
            sub.status === "active" ||
            sub.status === "trialing" ||
            sub.status === "past_due" ||
            sub.status === "unpaid" ||
            (sub.status === "canceled" && !!sub.cancel_at_period_end)
        ) ?? null;

      if (relevantSub) {
        stripeSubscription = {
          id: relevantSub.id,
          status: relevantSub.status,
          cancel_at_period_end: relevantSub.cancel_at_period_end ?? false,
          cancel_at: relevantSub.cancel_at ?? null,
          current_period_end: relevantSub.current_period_end ?? null,
        };
      }
    }

    const isSubscriber =
      !!profile?.is_subscriber ||
      isActiveStatus(profile?.subscription_status) ||
      isActiveStatus(stripeSubscription?.status);

    // If Stripe proves the user is active, backfill profile membership fields.
    if (profile?.id && stripeCustomerId && stripeSubscription) {
      const derivedIsSubscriber = isActiveStatus(stripeSubscription.status);

      const { error: syncErr } = await supabaseAdmin
        .from("profiles")
        .update({
          stripe_customer_id: stripeCustomerId,
          is_subscriber: derivedIsSubscriber,
          subscription_status: stripeSubscription.status,
        })
        .eq("id", profile.id);

      if (syncErr) {
        console.error("Failed to sync profile subscription state:", syncErr);
      }
    }

    return res.status(200).json({
      ok: true,
      isSubscriber,
      cancellationScheduled: !!stripeSubscription?.cancel_at_period_end,
      profile: profile
        ? {
            id: profile.id,
            email: profile.email,
            is_subscriber: profile.is_subscriber,
            subscription_status: profile.subscription_status,
            stripe_customer_id: stripeCustomerId,
          }
        : null,
      subscription: stripeSubscription,
    });
  } catch (err: any) {
    console.error("member-access error:", err);
    return res.status(500).json({
      error: err?.message || "Failed to check member access",
    });
  }
}