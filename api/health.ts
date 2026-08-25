import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setApiResponseHeaders } from "./_responseHeaders.js";

const REQUIRED_SERVER_CONFIGURATION = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID_SUBSCRIPTION",
  "SITE_URL",
] as const;

export default function handler(req: VercelRequest, res: VercelResponse) {
  setApiResponseHeaders(res);

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false });
  }

  const configured = REQUIRED_SERVER_CONFIGURATION.every(
    (name) => Boolean(process.env[name]),
  );

  return res.status(configured ? 200 : 503).json({ ok: configured });
}
