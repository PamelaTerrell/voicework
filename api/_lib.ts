import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage } from "http";
import type { VercelRequest } from "@vercel/node";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export async function requireUser(req: VercelRequest) {
  const auth =
    req.headers["authorization"] || req.headers["Authorization"];

  const token =
    typeof auth === "string" && auth.startsWith("Bearer ")
      ? auth.slice(7)
      : null;

  if (!token) {
    throw Object.assign(
      new Error("Missing Authorization Bearer token"),
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    throw Object.assign(new Error("Invalid token"), { status: 401 });
  }

  return data.user;
}

export async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export function isActiveSub(status?: string | null) {
  return status === "active" || status === "trialing";
}

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? null;
}

export async function getCustomerEmail(customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);

  if ("deleted" in customer && customer.deleted) {
    return null;
  }

  return normalizeEmail(customer.email);
}

export async function getMostRelevantSubscription(stripeCustomerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 10,
  });

  return (
    subscriptions.data.find(
      (sub) =>
        sub.status === "active" ||
        sub.status === "trialing" ||
        sub.status === "past_due" ||
        sub.status === "unpaid"
    ) ?? null
  );
}