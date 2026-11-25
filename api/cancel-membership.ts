import { hasApprovedMembershipPrice, hasCurrentMembershipAccess, membershipPaidThrough, stripeObjectId } from "./_membershipPrice.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  isActiveSub,
  normalizeEmail,
  requireUser,
  stripe,
  supabaseAdmin,
} from "./_lib.js";
import { setApiResponseHeaders } from "./_responseHeaders.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiResponseHeaders(res, { varyAuthorization: true });

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
      customer.id !== profile.stripe_customer_id ||
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
      isActiveSub(subscription.status) && hasApprovedMembershipPrice(subscription),
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
    if (stripeObjectId(candidate.customer) !== profile.stripe_customer_id || !hasCurrentMembershipAccess(candidate)) {
      return res.status(409).json({ error: "Unable to process cancellation safely." });
    }

    const alreadyScheduled =
      candidate.cancel_at_period_end || candidate.cancel_at !== null;
    let cancellationEffectiveAt = alreadyScheduled
      ? membershipPaidThrough(candidate)
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
        stripeObjectId(updated.customer) !== profile.stripe_customer_id ||
        !hasCurrentMembershipAccess(updated) ||
        !updated.cancel_at_period_end
      ) {
        return res.status(409).json({ error: "Unable to process cancellation safely." });
      }

      cancellationEffectiveAt = membershipPaidThrough(updated);
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
