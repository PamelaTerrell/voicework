import type { VercelRequest, VercelResponse } from "@vercel/node";
import { reconcileAuthenticatedMembership } from "./_membership.js";
import { normalizeEmail, requireUser } from "./_lib.js";
import { setApiResponseHeaders } from "./_responseHeaders.js";

function authenticationError(error: unknown) {
  if (!(error instanceof Error)) return null;

  const status = (error as Error & { status?: number }).status;
  if (status !== 401) return null;

  return error.message.includes("Missing Authorization")
    ? "Authentication required."
    : "Authentication expired or invalid.";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiResponseHeaders(res, { varyAuthorization: true });

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body =
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)
      : null;

  try {
    const user = await requireUser(req);

    if (
      req.query.email !== undefined ||
      req.query.userId !== undefined ||
      body?.email !== undefined ||
      body?.userId !== undefined
    ) {
      return res.status(400).json({
        error: "Identity parameters are not accepted.",
      });
    }

    if (!normalizeEmail(user.email)) {
      return res.status(400).json({
        error: "A verified account email is required.",
      });
    }

    const membership = await reconcileAuthenticatedMembership(user, {
      reconcileByVerifiedEmail: true,
    });

    if (membership.outcome === "conflict" || membership.outcome === "unavailable") {
      return res.status(503).json({ error: "Unable to verify membership." });
    }

    if (!membership.active) {
      return res.status(200).json({
        ok: true,
        isSubscriber: false,
        membershipStatus: "inactive",
        cancellationScheduled: false,
        cancellationEffectiveAt: null,
      });
    }

    return res.status(200).json({
      ok: true,
      isSubscriber: true,
      membershipStatus: "active",
      cancellationScheduled: membership.cancellationScheduled,
      cancellationEffectiveAt: membership.cancellationEffectiveAt,
    });
  } catch (error: unknown) {
    const authMessage = authenticationError(error);

    if (authMessage) {
      return res.status(401).json({ error: authMessage });
    }

    console.error("Unable to verify authenticated membership.");
    return res.status(500).json({ error: "Unable to verify membership." });
  }
}
