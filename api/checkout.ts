import type { VercelRequest, VercelResponse } from "@vercel/node";
import { stripe, supabaseAdmin, requireUser } from "./_lib.js";

type Body =
  | { mode: "subscription" }
  | { mode: "one_time"; episodeId: string };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireUser(req);
    const body = (
      typeof req.body === "string" ? JSON.parse(req.body) : req.body
    ) as Body;

    const siteUrl = process.env.SITE_URL || "http://localhost:5173";

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id,email,stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (pErr) {
      return res.status(500).json({ error: pErr.message });
    }

    // Ensure Stripe customer
    let customerId = profile.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email || user.email || undefined,
        metadata: { userId: user.id },
      });

      customerId = customer.id;

      const { error: uErr } = await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);

      if (uErr) {
        return res.status(500).json({ error: uErr.message });
      }
    }

    const successUrl = `${siteUrl}/thanks?success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/listen?canceled=1`;

    if (body.mode === "subscription") {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID_SUBSCRIPTION!,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
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

      return res.status(200).json({ url: session.url });
    }

    if (!("episodeId" in body) || !body.episodeId) {
      return res.status(400).json({ error: "episodeId required" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID_ONE_TIME!,
          quantity: 1,
        },
      ],
      success_url: `${successUrl}&episodeId=${encodeURIComponent(body.episodeId)}`,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        episodeId: body.episodeId,
        purchaseType: "one_time",
      },
      payment_intent_data: {
        metadata: {
          userId: user.id,
          episodeId: body.episodeId,
          purchaseType: "one_time",
        },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    return res.status(e?.status || 500).json({
      error: e?.message || "Server error",
    });
  }
}