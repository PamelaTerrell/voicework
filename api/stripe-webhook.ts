import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";
import { stripe, supabaseAdmin, readRawBody, isActiveSub } from "./_lib";

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    return res.status(400).send("Missing stripe-signature");
  }

  const raw = await readRawBody(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const purchaseType = session.metadata?.purchaseType;
      const userId = session.metadata?.userId;
      const episodeId = session.metadata?.episodeId;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;

      // Save Stripe customer ID to profile whenever possible
      if (userId && customerId) {
        await supabaseAdmin
          .from("profiles")
          .upsert(
            {
              id: userId,
              stripe_customer_id: customerId,
            },
            { onConflict: "id" }
          );
      }

      // One-time unlock
      if (purchaseType === "one_time") {
        if (session.payment_status === "paid" && userId && episodeId) {
          await supabaseAdmin.from("entitlements").upsert(
            {
              user_id: userId,
              episode_id: episodeId,
              source: "stripe_one_time",
            },
            { onConflict: "user_id,episode_id" }
          );
        }
      }

      // Subscription checkout completed
      if (purchaseType === "subscription") {
        if (userId) {
          await supabaseAdmin
            .from("profiles")
            .upsert(
              {
                id: userId,
                stripe_customer_id: customerId ?? null,
                is_subscriber: true,
                subscription_status: "active",
              },
              { onConflict: "id" }
            );
        }
      }

      return res.status(200).json({ received: true });
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;

      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      if (profileErr) {
        return res.status(500).send(profileErr.message);
      }

      if (profile?.id) {
        await supabaseAdmin
          .from("profiles")
          .update({
            is_subscriber: isActiveSub(sub.status),
            subscription_status: sub.status,
          })
          .eq("id", profile.id);
      }

      return res.status(200).json({ received: true });
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    return res.status(500).send(err?.message || "Webhook handler failed");
  }
}
