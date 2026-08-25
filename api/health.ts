import type { VercelRequest, VercelResponse } from "@vercel/node";

const REQUIRED_SERVER_CONFIGURATION = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID_SUBSCRIPTION",
  "STRIPE_PRICE_ID_ONE_TIME",
  "SITE_URL",
] as const;

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false });
  }

  const configured = REQUIRED_SERVER_CONFIGURATION.every(
    (name) => Boolean(process.env[name]),
  );

  return res.status(configured ? 200 : 503).json({ ok: configured });
}
