import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin, requireUser } from "./_lib.js";

function isActiveStatus(status?: string | null) {
  return status === "active" || status === "trialing";
}

function getEpisodeAudioPath(episodeId: string) {
  switch (episodeId) {
    case "conversation-ep2":
      return "conversation-ep2/conversation-full.mp3";
    case "replays-ep1":
      return "replays-ep1/full.mp3";
    default:
      return `${episodeId}/full.mp3`;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const episodeId =
      typeof req.query.episodeId === "string" ? req.query.episodeId : "";

    if (!episodeId) {
      return res.status(400).json({ error: "episodeId required" });
    }

    const user = await requireUser(req);

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("is_subscriber, subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    if (pErr) {
      return res.status(500).json({ error: pErr.message });
    }

    let allowed =
      !!profile?.is_subscriber || isActiveStatus(profile?.subscription_status);

    if (!allowed) {
      const { data: ent, error: eErr } = await supabaseAdmin
        .from("entitlements")
        .select("id")
        .eq("user_id", user.id)
        .eq("episode_id", episodeId)
        .maybeSingle();

      if (eErr) {
        return res.status(500).json({ error: eErr.message });
      }

      allowed = !!ent?.id;
    }

    if (!allowed) {
      return res.status(403).json({ error: "Not entitled" });
    }

    const path = getEpisodeAudioPath(episodeId);

    const { data, error } = await supabaseAdmin.storage
      .from("episodes")
      .createSignedUrl(path, 60 * 10);

    if (error || !data?.signedUrl) {
      return res.status(404).json({
        error: `Audio file not found for ${path}`,
      });
    }

    return res.status(200).json({ url: data.signedUrl });
  } catch (e: any) {
    return res.status(e?.status || 500).json({
      error: e?.message || "Server error",
    });
  }
}