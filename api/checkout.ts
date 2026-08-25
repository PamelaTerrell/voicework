import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  normalizeEmail,
  requireUser,
  stripe,
  supabaseAdmin,
} from "./_lib.js";
import { setApiResponseHeaders } from "./_responseHeaders.js";

type CheckoutRequest = { mode: "subscription" };

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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return res.status(500).json({ error: "Unable to start checkout." });
    }

    let customerId = profile?.stripe_customer_id ?? null;

    if (customerId) {
      const customer = await stripe.customers.retrieve(customerId);
      if (
        ("deleted" in customer && customer.deleted) ||
        normalizeEmail(customer.email) !== trustedEmail
      ) {
        return res.status(400).json({
          error: "The billing account linked to this sign-in cannot be used.",
        });
      }
    } else {
      const customer = await stripe.customers.create({
        email: trustedEmail,
        metadata: { userId: user.id },
      });
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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/listen?canceled=1`,
      client_reference_id: user.id,
      metadata: purchaseMetadata,
      subscription_data: { metadata: purchaseMetadata },
    });

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
