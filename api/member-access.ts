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

    let { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, is_subscriber, subscription_status, stripe_customer_id")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    let stripeCustomerId = profile?.stripe_customer_id ?? null;

    if (!stripeCustomerId) {
      const customers = await stripe.customers.list({
        email,
        limit: 10,
      });

      const matchingCustomer =
        customers.data.find((c) => normalizeEmail(c.email) === email) ?? null;

      if (matchingCustomer) {
        stripeCustomerId = matchingCustomer.id;
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

    // Critical fix: if Stripe proves access, ensure a profile row exists for this signed-in user
    if (userId && stripeCustomerId && stripeSubscription) {
      const { error: upsertErr } = await supabaseAdmin.from("profiles").upsert(
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
        console.error("Failed to upsert profile from member-access:", upsertErr);
      } else {
        const refreshed = await supabaseAdmin
          .from("profiles")
          .select("id, email, is_subscriber, subscription_status, stripe_customer_id")
          .eq("id", userId)
          .maybeSingle();

        if (!refreshed.error) {
          profile = refreshed.data ?? profile;
        }
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