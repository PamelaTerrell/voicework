import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "node:crypto";
import {
  normalizeEmail,
  requireUser,
  stripe,
  supabaseAdmin,
} from "./_lib.js";
import { setApiResponseHeaders } from "./_responseHeaders.js";
import { reconcileAuthenticatedMembership } from "./_membership.js";

type CheckoutRequest = { mode: "subscription" };

const CHECKOUT_IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;
const TERMINAL_SUBSCRIPTION_STATUSES = new Set([
  "canceled",
  "incomplete_expired",
]);
const ATTENTION_REQUIRED_SUBSCRIPTION_STATUSES = new Set([
  "incomplete",
  "past_due",
  "paused",
  "unpaid",
]);

function trustedUserDigest(userId: string) {
  return createHash("sha256").update(userId).digest("hex");
}

function customerCreationIdempotencyKey(userId: string) {
  // Stable per authenticated user so concurrent first-time requests converge.
  return `night-listener:customer:v1:${trustedUserDigest(userId)}`;
}

function checkoutSessionIdempotencyKey(userId: string, now = Date.now()) {
  // Ten-minute epoch buckets deduplicate bursts but permit a deliberate later retry.
  const window = Math.floor(now / CHECKOUT_IDEMPOTENCY_WINDOW_MS);
  return `night-listener:subscription-checkout:v1:${trustedUserDigest(userId)}:${window}`;
}

function subscriptionCustomerId(subscription: { customer?: unknown }) {
  if (typeof subscription.customer === "string") return subscription.customer;
  if (
    subscription.customer &&
    typeof subscription.customer === "object" &&
    "id" in subscription.customer &&
    typeof subscription.customer.id === "string"
  ) {
    return subscription.customer.id;
  }
  return null;
}

async function verifyNoCurrentSubscription(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  if (!Array.isArray(subscriptions.data) || subscriptions.has_more !== false) {
    return "unclear" as const;
  }

  let hasCurrentSubscription = false;
  let hasAttentionRequiredSubscription = false;

  for (const subscription of subscriptions.data) {
    if (subscriptionCustomerId(subscription) !== customerId) return "unclear" as const;
    if (subscription.status === "active" || subscription.status === "trialing") {
      hasCurrentSubscription = true;
      continue;
    }
    if (ATTENTION_REQUIRED_SUBSCRIPTION_STATUSES.has(subscription.status)) {
      hasAttentionRequiredSubscription = true;
      continue;
    }
    if (!TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status)) {
      return "unclear" as const;
    }
  }

  if (hasCurrentSubscription) return "current" as const;
  if (hasAttentionRequiredSubscription) return "attention" as const;
  return "available" as const;
}

function authenticationError(error: unknown) {
  if (!(error instanceof Error)) return null;

  const status = (error as Error & { status?: number }).status;
  if (status !== 401) return null;

  return error.message.includes("Missing Authorization")
    ? "Authentication required."
    : "Authentication expired or invalid.";
}

function parseCheckoutRequest(body: unknown): CheckoutRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const record = body as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  if (
    record.mode === "subscription" &&
    keys.length === 1 &&
    keys[0] === "mode"
  ) {
    return { mode: "subscription" };
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiResponseHeaders(res, { varyAuthorization: true });

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);
    const trustedEmail = normalizeEmail(user.email);

    if (!trustedEmail) {
      return res.status(400).json({
        error: "A verified account email is required.",
      });
    }

    let rawBody: unknown = req.body;
    if (typeof rawBody === "string") {
      try {
        rawBody = JSON.parse(rawBody);
      } catch {
        return res.status(400).json({ error: "Invalid checkout request." });
      }
    }

    const body = parseCheckoutRequest(rawBody);
    if (!body) {
      return res.status(400).json({ error: "Invalid checkout request." });
    }

    const priceId = process.env.STRIPE_PRICE_ID_SUBSCRIPTION;
    const siteUrl = process.env.SITE_URL;

    if (!priceId || !siteUrl) {
      console.error("Checkout is not configured.");
      return res.status(500).json({ error: "Unable to start checkout." });
    }

    const membership = await reconcileAuthenticatedMembership(user, {
      reconcileByVerifiedEmail: true,
    });
    if (membership.outcome === "active") {
      return res.status(409).json({
        error: "An active membership already exists for this account.",
      });
    }
    if (membership.outcome === "conflict" || membership.outcome === "unavailable") {
      return res.status(409).json({ error: "Unable to start checkout safely." });
    }

    let customerId = membership.customerId;

    if (customerId) {
      const subscriptionState = await verifyNoCurrentSubscription(customerId);
      if (subscriptionState === "current") {
        return res.status(409).json({
          error: "An active membership already exists for this account.",
        });
      }
      if (subscriptionState === "attention") {
        return res.status(409).json({
          error:
            "An existing membership requires attention before starting a new checkout.",
        });
      }
      if (subscriptionState !== "available") {
        return res.status(409).json({ error: "Unable to start checkout safely." });
      }
    } else {
      const customer = await stripe.customers.create(
        {
          email: trustedEmail,
          metadata: { userId: user.id },
        },
        { idempotencyKey: customerCreationIdempotencyKey(user.id) },
      );
      customerId = customer.id;

      const { error: profileUpdateError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: trustedEmail,
            stripe_customer_id: customerId,
          },
          { onConflict: "id" }
        );

      if (profileUpdateError) {
        return res.status(500).json({ error: "Unable to start checkout." });
      }
    }

    const purchaseMetadata = {
      userId: user.id,
      purchaseType: "subscription",
    };

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${siteUrl}/thanks?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/listen?canceled=1`,
        client_reference_id: user.id,
        metadata: purchaseMetadata,
        subscription_data: { metadata: purchaseMetadata },
      },
      { idempotencyKey: checkoutSessionIdempotencyKey(user.id) },
    );

    if (!session.url) {
      return res.status(500).json({ error: "Unable to start checkout." });
    }

    return res.status(200).json({ url: session.url });
  } catch (error: unknown) {
    const authMessage = authenticationError(error);
    if (authMessage) return res.status(401).json({ error: authMessage });

    console.error("Unable to create authenticated checkout.");
    return res.status(500).json({ error: "Unable to start checkout." });
  }
}
