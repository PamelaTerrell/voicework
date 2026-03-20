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

    const userId =
      typeof req.query.userId === "string" ? req.query.userId : null;

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    // ---------------------------------------
    // 1. Lookup profile
    // ---------------------------------------
    let { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, email, is_subscriber, subscription_status, stripe_customer_id"
      )
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    let stripeCustomerId = profile?.stripe_customer_id ?? null;

    // ---------------------------------------
    // 2. Fallback: find Stripe customer by email
    // ---------------------------------------
    if (!stripeCustomerId) {
      const customers = await stripe.customers.list({
        email,
        limit: 10,
      });

      const match =
        customers.data.find((c) => normalizeEmail(c.email) === email) ?? null;

      if (match) {
        stripeCustomerId = match.id;
      }
    }

    // ---------------------------------------
    // 3. Get subscription from Stripe
    // ---------------------------------------
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

    // ---------------------------------------
    // 4. Determine access
    // ---------------------------------------
    const isSubscriber =
      !!profile?.is_subscriber ||
      isActiveStatus(profile?.subscription_status) ||
      isActiveStatus(stripeSubscription?.status);

    // ---------------------------------------
    // 5. Self-heal profile (CRITICAL)
    // ---------------------------------------
    if (userId && stripeCustomerId && stripeSubscription) {
      const { error: upsertErr } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: userId,
            email,
            stripe_customer_id: stripeCustomerId,
            is_subscriber: isActiveStatus(stripeSubscription.status),
            subscription_status: stripeSubscription.status,
          },
          { onConflict: "id" }
        );

      if (upsertErr) {
        console.error("Profile upsert failed:", upsertErr);
      } else {
        const refreshed = await supabaseAdmin
          .from("profiles")
          .select(
            "id, email, is_subscriber, subscription_status, stripe_customer_id"
          )
          .eq("id", userId)
          .maybeSingle();

        if (!refreshed.error) {
          profile = refreshed.data ?? profile;
        }
      }
    }

    // ---------------------------------------
    // 6. Response
    // ---------------------------------------
    return res.status(200).json({
      ok: true,
      isSubscriber,
      cancellationScheduled: !!stripeSubscription?.cancel_at_period_end,
      cancellationEffectiveAt:
        stripeSubscription?.cancel_at ??
        stripeSubscription?.current_period_end ??
        null,
      profile: profile
        ? {
            id: profile.id,
            email: profile.email,
            is_subscriber: profile.is_subscriber,
            subscription_status: profile.subscription_status,
            stripe_customer_id: profile.stripe_customer_id,
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