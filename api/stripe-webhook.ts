import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";
import {
  stripe,
  supabaseAdmin,
  readRawBody,
  isActiveSub,
  normalizeEmail,
  getCustomerEmail,
} from "./_lib.js";

export const config = { api: { bodyParser: false } };

async function upsertProfileSubscription(args: {
  userId?: string | null;
  email?: string | null;
  stripeCustomerId?: string | null;
  subscriptionStatus: string;
  isSubscriber: boolean;
}) {
  const {
    userId,
    email,
    stripeCustomerId,
    subscriptionStatus,
    isSubscriber,
  } = args;

  const normalizedEmail = normalizeEmail(email);

  if (userId) {
    const { error } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: normalizedEmail,
        stripe_customer_id: stripeCustomerId ?? null,
        is_subscriber: isSubscriber,
        subscription_status: subscriptionStatus,
      },
      { onConflict: "id" }
    );

    if (error) throw error;
    return;
  }

  if (stripeCustomerId) {
    const { data: profileByCustomer, error: findByCustomerErr } =
      await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle();

    if (findByCustomerErr) throw findByCustomerErr;

    if (profileByCustomer?.id) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          email: normalizedEmail,
          is_subscriber: isSubscriber,
          subscription_status: subscriptionStatus,
        })
        .eq("id", profileByCustomer.id);

      if (error) throw error;
      return;
    }
  }

  if (normalizedEmail) {
    const { data: profileByEmail, error: findByEmailErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (findByEmailErr) throw findByEmailErr;

    if (profileByEmail?.id) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          stripe_customer_id: stripeCustomerId ?? null,
          is_subscriber: isSubscriber,
          subscription_status: subscriptionStatus,
        })
        .eq("id", profileByEmail.id);

      if (error) throw error;
    }
  }
}

async function setSubscriptionByCustomerId(args: {
  stripeCustomerId: string;
  subscriptionStatus: string;
  isSubscriber: boolean;
}) {
  const { stripeCustomerId, subscriptionStatus, isSubscriber } = args;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      subscription_status: subscriptionStatus,
      is_subscriber: isSubscriber,
    })
    .eq("stripe_customer_id", stripeCustomerId);

  if (error) throw error;
}

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

      const purchaseType = session.metadata?.purchaseType ?? null;
      const userId = session.metadata?.userId ?? null;
      const episodeId = session.metadata?.episodeId ?? null;

      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null;

      const email = normalizeEmail(
        session.customer_details?.email || session.customer_email || null
      );

      if (userId) {
        const { error } = await supabaseAdmin.from("profiles").upsert(
          {
            id: userId,
            email,
            stripe_customer_id: customerId,
          },
          { onConflict: "id" }
        );

        if (error) throw error;
      } else if (email && customerId) {
        const { data: existingProfile, error: existingProfileErr } =
          await supabaseAdmin
            .from("profiles")
            .select("id")
            .ilike("email", email)
            .maybeSingle();

        if (existingProfileErr) throw existingProfileErr;

        if (existingProfile?.id) {
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              stripe_customer_id: customerId,
            })
            .eq("id", existingProfile.id);

          if (error) throw error;
        }
      }

      if (purchaseType === "one_time") {
        if (session.payment_status === "paid" && userId && episodeId) {
          const { error } = await supabaseAdmin.from("entitlements").upsert(
            {
              user_id: userId,
              episode_id: episodeId,
              source: "stripe_one_time",
            },
            { onConflict: "user_id,episode_id" }
          );

          if (error) throw error;
        }
      }

      if (purchaseType === "subscription" && session.payment_status === "paid") {
        await upsertProfileSubscription({
          userId,
          email,
          stripeCustomerId: customerId,
          isSubscriber: true,
          subscriptionStatus: "active",
        });
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

      const email = await getCustomerEmail(customerId);

      await upsertProfileSubscription({
        email,
        stripeCustomerId: customerId,
        isSubscriber: isActiveSub(sub.status),
        subscriptionStatus: sub.status,
      });

      return res.status(200).json({ received: true });
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;

      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

      if (customerId) {
        await setSubscriptionByCustomerId({
          stripeCustomerId: customerId,
          subscriptionStatus: "active",
          isSubscriber: true,
        });
      }

      return res.status(200).json({ received: true });
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;

      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

      if (customerId) {
        await setSubscriptionByCustomerId({
          stripeCustomerId: customerId,
          subscriptionStatus: "past_due",
          isSubscriber: false,
        });
      }

      return res.status(200).json({ received: true });
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook error:", err);
    return res.status(500).send(err?.message || "Webhook handler failed");
  }
}