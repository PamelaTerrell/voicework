import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID_SUBSCRIPTION",
    "STRIPE_PRICE_ID_ONE_TIME",
    "SITE_URL",
  ];

  const missing = required.filter((k) => !process.env[k]);

  res.status(200).json({
    ok: missing.length === 0,
    missing,
  });
}
