import type { VercelRequest, VercelResponse } from "@vercel/node";
import { stripe } from "./_lib.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: "Missing customerId" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.SITE_URL}/members`,
      cancel_url: `${process.env.SITE_URL}/members`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "Failed to resume membership",
    });
  }
}