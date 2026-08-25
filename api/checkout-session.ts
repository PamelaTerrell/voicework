import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isApprovedEpisodeId } from "./_episodes.js";
import { isActiveSub, requireUser, stripe } from "./_lib.js";

const CHECKOUT_SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]{10,}$/;

function authenticationError(error: unknown) {
  if (!(error instanceof Error)) return null;

  const status = (error as Error & { status?: number }).status;
  if (status !== 401) return null;

  return error.message.includes("Missing Authorization")
    ? "Authentication required."
    : "Authentication expired or invalid.";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);
    const sessionId =
      typeof req.query.session_id === "string" ? req.query.session_id : "";

    if (!CHECKOUT_SESSION_ID.test(sessionId)) {
      return res.status(400).json({ state: "invalid" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    const purchaseType = session.metadata?.purchaseType;
    const metadataUserId = session.metadata?.userId;

    if (
      metadataUserId !== user.id ||
      session.client_reference_id !== user.id
    ) {
      return res.status(404).json({ state: "invalid" });
    }

    const validOneTime =
      purchaseType === "one_time" &&
      session.mode === "payment" &&
      isApprovedEpisodeId(session.metadata?.episodeId);
    const subscription =
      session.subscription && typeof session.subscription !== "string"
        ? session.subscription
        : null;
    const validSubscription =
      purchaseType === "subscription" &&
      session.mode === "subscription" &&
      !!subscription &&
      isActiveSub(subscription.status);

    if (!validOneTime && !validSubscription) {
      return res.status(404).json({ state: "invalid" });
    }

    const responsePurchaseType = validOneTime ? "one_time" : "subscription";

    if (session.status === "expired") {
      return res.status(200).json({
        state: "failed",
        purchaseType: responsePurchaseType,
      });
    }

    const paymentComplete = validOneTime
      ? session.payment_status === "paid"
      : session.payment_status === "paid" ||
        session.payment_status === "no_payment_required";

    if (session.status !== "complete" || !paymentComplete) {
      return res.status(200).json({
        state: "pending",
        purchaseType: responsePurchaseType,
      });
    }

    return res.status(200).json({
      state: "verified",
      purchaseType: responsePurchaseType,
    });
  } catch (error: unknown) {
    const authMessage = authenticationError(error);
    if (authMessage) return res.status(401).json({ error: authMessage });

    return res.status(404).json({ state: "invalid" });
  }
}
