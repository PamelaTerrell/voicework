import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin, requireUser } from "./_lib.js";

const FREE_EPISODE_ID = "conversation-ep2";

const EPISODE_FILE_MAP: Record<
  string,
  { preview: string; full: string }
> = {
  "versions-ep5": {
    preview: "never-meant-to-see-ep5/preview.mp3",
    full: "versions-ep5/full.mp3",
  },
  "conversation-ep2": {
    preview: "conversation-ep2/preview.mp3",
    full: "conversation-ep2/full.mp3",
  },
  "replays-ep1": {
    preview: "replays-ep1/preview.mp3",
    full: "replays-ep1/full.mp3",
  },
  "say-sorry-ep3": {
    preview: "say-sorry-ep3/preview.mp3",
    full: "say-sorry-ep3/full.mp3",
  },
  "resentment-ep4": {
    preview: "resentment-ep4/preview.mp3",
    full: "resentment-ep4/full.mp3",
  },
};

function isActiveStatus(status?: string | null) {
  return status === "active" || status === "trialing";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const episodeId =
      typeof req.query.episodeId === "string" ? req.query.episodeId : "";

    const type =
      typeof req.query.type === "string" && req.query.type === "preview"
        ? "preview"
        : "full";

    if (!episodeId) {
      return res.status(400).json({ error: "episodeId required" });
    }

    const fileEntry = EPISODE_FILE_MAP[episodeId];

    if (!fileEntry) {
      return res.status(404).json({ error: `Unknown episodeId: ${episodeId}` });
    }

    const user = await requireUser(req);

    // Allow one featured/free episode for any signed-in user
    let allowed = episodeId === FREE_EPISODE_ID || type === "preview";

    if (!allowed) {
      const { data: profile, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("is_subscriber, subscription_status")
        .eq("id", user.id)
        .maybeSingle();

      if (pErr) {
        return res.status(500).json({ error: pErr.message });
      }

      allowed =
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
    }

    if (!allowed) {
      return res.status(403).json({ error: "Not entitled" });
    }

    const path = fileEntry[type];

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