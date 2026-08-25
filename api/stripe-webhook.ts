import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";
import { isApprovedEpisodeId } from "./_episodes.js";
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
  } catch {
    return res.status(400).send("Invalid webhook signature");
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

      const trustedUserLink =
        !!userId && session.client_reference_id === userId;

      if (
        purchaseType === "one_time" &&
        session.mode === "payment" &&
        session.status === "complete" &&
        session.payment_status === "paid" &&
        trustedUserLink &&
        isApprovedEpisodeId(episodeId)
      ) {
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

      if (
        purchaseType === "subscription" &&
        session.mode === "subscription" &&
        session.status === "complete" &&
        (session.payment_status === "paid" ||
          session.payment_status === "no_payment_required") &&
        trustedUserLink &&
        customerId &&
        session.subscription
      ) {
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
  } catch {
    console.error("Stripe webhook processing failed.");
    return res.status(500).send("Webhook handler failed");
  }
}
