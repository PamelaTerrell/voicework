import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";
import {
  isActiveSub,
  normalizeEmail,
  requireUser,
  stripe,
  supabaseAdmin,
} from "./_lib.js";

function authenticationError(error: unknown) {
  if (!(error instanceof Error)) return null;
  const status = (error as Error & { status?: number }).status;
  if (status !== 401) return null;
  return error.message.includes("Missing Authorization")
    ? "Authentication required."
    : "Authentication expired or invalid.";
}

function hasRequestParameters(body: unknown): boolean {
  if (body === undefined || body === null || body === "") return false;
  if (typeof body !== "object" || Array.isArray(body)) return true;
  return Object.keys(body as Record<string, unknown>).length > 0;
}

function subscriptionCustomerId(subscription: Stripe.Subscription) {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

function trustedPaidThrough(subscription: Stripe.Subscription): number | null {
  const effectiveAt =
    subscription.cancel_at ?? subscription.current_period_end ?? null;
  return typeof effectiveAt === "number" &&
    Number.isFinite(effectiveAt) &&
    effectiveAt > Date.now() / 1000
    ? effectiveAt
    : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);

    if (hasRequestParameters(req.body)) {
      return res.status(400).json({
        error: "Cancellation request parameters are not accepted.",
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
      .select("id, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Unable to read authenticated cancellation profile.");
      return res.status(500).json({ error: "Unable to process cancellation safely." });
    }

    if (!profile?.stripe_customer_id) {
      return res.status(400).json({
        error: "No verified active membership is available to cancel.",
      });
    }

    const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
    if (
      ("deleted" in customer && customer.deleted) ||
      normalizeEmail(customer.email) !== trustedEmail
    ) {
      return res.status(400).json({
        error: "No verified active membership is available to cancel.",
      });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "all",
      limit: 10,
    });

    if (subscriptions.has_more) {
      return res.status(409).json({ error: "Unable to process cancellation safely." });
    }

    const candidates = subscriptions.data.filter((subscription) =>
      isActiveSub(subscription.status),
    );

    if (candidates.length !== 1) {
      return res.status(candidates.length === 0 ? 400 : 409).json({
        error:
          candidates.length === 0
            ? "No verified active membership is available to cancel."
            : "Unable to process cancellation safely.",
      });
    }

    const candidate = candidates[0];
    if (subscriptionCustomerId(candidate) !== profile.stripe_customer_id) {
      return res.status(409).json({ error: "Unable to process cancellation safely." });
    }

    const alreadyScheduled =
      candidate.cancel_at_period_end || candidate.cancel_at !== null;
    let cancellationEffectiveAt = alreadyScheduled
      ? trustedPaidThrough(candidate)
      : null;

    if (alreadyScheduled && !cancellationEffectiveAt) {
      return res.status(409).json({ error: "Unable to process cancellation safely." });
    }

    let verifiedSubscription = candidate;
    if (!alreadyScheduled) {
      const updated = await stripe.subscriptions.update(candidate.id, {
        cancel_at_period_end: true,
      });

      if (
        subscriptionCustomerId(updated) !== profile.stripe_customer_id ||
        !isActiveSub(updated.status) ||
        !updated.cancel_at_period_end
      ) {
        return res.status(409).json({ error: "Unable to process cancellation safely." });
      }

      cancellationEffectiveAt = trustedPaidThrough(updated);
      if (!cancellationEffectiveAt) {
        return res.status(409).json({ error: "Unable to process cancellation safely." });
      }
      verifiedSubscription = updated;
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        is_subscriber: true,
        subscription_status: verifiedSubscription.status,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Unable to synchronize authenticated cancellation profile.");
      return res.status(500).json({ error: "Unable to process cancellation safely." });
    }

    return res.status(200).json({
      cancellationScheduled: true,
      cancellationEffectiveAt,
      alreadyScheduled,
    });
  } catch (error: unknown) {
    const authMessage = authenticationError(error);
    if (authMessage) return res.status(401).json({ error: authMessage });
    console.error("Unable to process authenticated membership cancellation.");
    return res.status(500).json({ error: "Unable to process cancellation safely." });
  }
}
