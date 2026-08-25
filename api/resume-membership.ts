import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body =
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)
      : null;

  try {
    const user = await requireUser(req);

    if (body?.customerId !== undefined) {
      return res.status(400).json({
        error: "Customer identity parameters are not accepted.",
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Unable to read authenticated membership profile.");
      return res.status(500).json({ error: "Unable to resume membership." });
    }

    if (!profile?.stripe_customer_id) {
      return res.status(400).json({
        error: "No membership billing account is linked to this sign-in.",
      });
    }

    const trustedEmail = normalizeEmail(user.email);

    if (!trustedEmail) {
      return res.status(400).json({
        error: "A verified account email is required.",
      });
    }

    const customer = await stripe.customers.retrieve(profile.stripe_customer_id);

    if (
      ("deleted" in customer && customer.deleted) ||
      normalizeEmail(customer.email) !== trustedEmail
    ) {
      return res.status(400).json({
        error: "No membership billing account is linked to this sign-in.",
      });
    }

    const subscriptionPriceId = process.env.STRIPE_PRICE_ID_SUBSCRIPTION;
    const siteUrl = process.env.SITE_URL;

    if (!subscriptionPriceId || !siteUrl) {
      console.error("Membership resumption is not configured.");
      return res.status(500).json({ error: "Unable to resume membership." });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: profile.stripe_customer_id,
      line_items: [
        {
          price: subscriptionPriceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/members`,
      cancel_url: `${siteUrl}/members`,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        purchaseType: "subscription",
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          purchaseType: "subscription",
        },
      },
    });

    if (!session.url) {
      return res.status(500).json({ error: "Unable to resume membership." });
    }

    return res.status(200).json({ url: session.url });
  } catch (error: unknown) {
    const authMessage = authenticationError(error);

    if (authMessage) {
      return res.status(401).json({ error: authMessage });
    }

    console.error("Unable to create authenticated membership checkout.");
    return res.status(500).json({ error: "Unable to resume membership." });
  }
}
