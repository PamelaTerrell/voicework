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
import {
  bindCheckoutAttempt,
  checkoutAttemptIdempotencyKey,
  claimCheckoutAttempt,
  inspectOwnedCheckoutSession,
  invalidateOwnedOpenAttemptForUser,
  retrieveOwnedCheckoutSession,
  transitionCheckoutAttempt,
} from "./_checkoutAttempt.js";

type CheckoutRequest = { mode: "subscription" };

const STRIPE_MINIMUM_CHECKOUT_FUTURE_SECONDS = 30 * 60;
const CHECKOUT_CREATION_TRANSIT_BUFFER_SECONDS = 2 * 60;
const MINIMUM_SAFE_CHECKOUT_FUTURE_SECONDS =
  STRIPE_MINIMUM_CHECKOUT_FUTURE_SECONDS +
  CHECKOUT_CREATION_TRANSIT_BUFFER_SECONDS;
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
      if (membership.customerId) {
        await invalidateOwnedOpenAttemptForUser(user.id, membership.customerId);
      }
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
        await invalidateOwnedOpenAttemptForUser(user.id, customerId);
        return res.status(409).json({
          error: "An active membership already exists for this account.",
        });
      }
      if (subscriptionState === "attention") {
        await invalidateOwnedOpenAttemptForUser(user.id, customerId);
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
    const successUrl = `${siteUrl}/thanks?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/listen?canceled=1`;

    const attempt = await claimCheckoutAttempt({
      userId: user.id,
      customerId,
      priceId,
      successUrl,
      cancelUrl,
    });

    if (attempt.outcome === "busy") {
      return res.status(409).json({
        error: "Checkout is already being prepared. Please try again shortly.",
      });
    }
    if (attempt.outcome === "blocked") {
      return res.status(409).json({ error: "Unable to start checkout safely." });
    }

    if (attempt.outcome === "open") {
      const { inspection } = await retrieveOwnedCheckoutSession(attempt);
      if (inspection.state === "open") {
        return res.status(200).json({ url: inspection.url });
      }

      const transition = await transitionCheckoutAttempt({
        attempt,
        targetState: inspection.state,
      });
      if (transition === "stale") {
        return res.status(409).json({ error: "Unable to start checkout safely." });
      }
      return res.status(409).json({
        error: inspection.state === "completed"
          ? "An existing checkout has already been completed."
          : "The previous checkout has expired. Please try again.",
      });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      attempt.stripeExpiresAt <=
      nowSeconds + MINIMUM_SAFE_CHECKOUT_FUTURE_SECONDS
    ) {
      const transition = await transitionCheckoutAttempt({
        attempt,
        targetState: "blocked",
        leaseToken: attempt.leaseToken,
      });
      if (transition !== "transitioned") {
        return res.status(409).json({ error: "Unable to start checkout safely." });
      }
      return res.status(409).json({ error: "Unable to start checkout safely." });
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: attempt.priceId, quantity: 1 }],
        success_url: attempt.successUrl,
        cancel_url: attempt.cancelUrl,
        client_reference_id: user.id,
        metadata: purchaseMetadata,
        subscription_data: { metadata: purchaseMetadata },
        expires_at: attempt.stripeExpiresAt,
      },
      { idempotencyKey: checkoutAttemptIdempotencyKey(attempt.attemptId) },
    );
    const candidateAttempt = {
      ...attempt,
      sessionId: session.id,
    };
    const returnedInspection = inspectOwnedCheckoutSession(
      session,
      candidateAttempt,
      0,
    );
    if (!returnedInspection) {
      return res.status(500).json({ error: "Unable to start checkout." });
    }

    const { inspection } = await retrieveOwnedCheckoutSession(candidateAttempt);
    const bound = await bindCheckoutAttempt({
      attempt,
      leaseToken: attempt.leaseToken,
      sessionId: session.id,
      expiresAt: inspection.expiresAt,
      state: inspection.state,
    });
    if (!bound) {
      return res.status(500).json({ error: "Unable to start checkout." });
    }
    if (inspection.state !== "open") {
      return res.status(409).json({
        error: inspection.state === "completed"
          ? "An existing checkout has already been completed."
          : "The previous checkout has expired. Please try again.",
      });
    }

    const finalSubscriptionState = await verifyNoCurrentSubscription(customerId);
    if (finalSubscriptionState !== "available") {
      if (
        finalSubscriptionState === "current" ||
        finalSubscriptionState === "attention"
      ) {
        await invalidateOwnedOpenAttemptForUser(user.id, customerId);
      }
      return res.status(409).json({ error: "Unable to start checkout safely." });
    }

    return res.status(200).json({ url: inspection.url });
  } catch (error: unknown) {
    const authMessage = authenticationError(error);
    if (authMessage) return res.status(401).json({ error: authMessage });

    console.error("Unable to create authenticated checkout.");
    return res.status(500).json({ error: "Unable to start checkout." });
  }
}
