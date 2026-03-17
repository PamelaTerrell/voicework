import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser, stripe, supabaseAdmin } from "./_lib.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireUser(req);

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, stripe_customer_id, subscription_status, is_subscriber")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      return res.status(500).json({ error: profileErr.message });
    }

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    if (!profile.stripe_customer_id) {
      return res.status(400).json({
        error: "No Stripe customer is attached to this account.",
      });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "all",
      limit: 10,
    });

    const activeSubscription =
      subscriptions.data.find(
        (sub) =>
          sub.status === "active" ||
          sub.status === "trialing" ||
          sub.status === "past_due" ||
          sub.status === "unpaid"
      ) ?? null;

    if (!activeSubscription) {
      return res.status(404).json({
        error: "No active subscription was found for this account.",
      });
    }

    const updatedSub = await stripe.subscriptions.update(activeSubscription.id, {
      cancel_at_period_end: true,
    });

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_status: updatedSub.status,
      })
      .eq("id", user.id);

    if (updateErr) {
      return res.status(500).json({ error: updateErr.message });
    }

    return res.status(200).json({
      ok: true,
      message:
        updatedSub.cancel_at_period_end
          ? "Your membership will cancel at the end of the current billing period."
          : "Your membership cancellation has been scheduled.",
      subscription: {
        id: updatedSub.id,
        status: updatedSub.status,
        cancel_at_period_end: updatedSub.cancel_at_period_end,
        current_period_end: updatedSub.current_period_end ?? null,
      },
    });
  } catch (e: any) {
    return res.status(e?.status || 500).json({
      error: e?.message || "Server error",
    });
  }
}