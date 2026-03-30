import type { VercelRequest, VercelResponse } from "@vercel/node";
import { stripe } from "./_lib.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionId =
    typeof req.query.session_id === "string" ? req.query.session_id : "";

  if (!sessionId) {
    return res.status(400).json({ error: "session_id required" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return res.status(200).json({
      email: session.customer_details?.email ?? session.customer_email ?? "",
    });
  } catch (e: any) {
    console.error("Error retrieving checkout session:", e);

    return res.status(e?.statusCode || 500).json({
      error: e?.message || "Unable to retrieve checkout session",
    });
  }
}