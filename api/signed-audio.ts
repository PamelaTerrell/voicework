import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin, requireUser } from "./_lib";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const episodeId = typeof req.query.episodeId === "string" ? req.query.episodeId : "";
    if (!episodeId) return res.status(400).json({ error: "episodeId required" });

    const user = await requireUser(req);

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("is_subscriber")
      .eq("id", user.id)
      .single();

    if (pErr) return res.status(500).json({ error: pErr.message });

    let allowed = !!profile?.is_subscriber;

    if (!allowed) {
      const { data: ent, error: eErr } = await supabaseAdmin
        .from("entitlements")
        .select("id")
        .eq("user_id", user.id)
        .eq("episode_id", episodeId)
        .maybeSingle();

      if (eErr) return res.status(500).json({ error: eErr.message });
      allowed = !!ent?.id;
    }

    if (!allowed) return res.status(403).json({ error: "Not entitled" });

    const path = `episodes/${episodeId}/full.mp3`;

    const { data, error } = await supabaseAdmin.storage.from("episodes").createSignedUrl(path, 60 * 10);
    if (error) return res.status(404).json({ error: error.message });

    return res.status(200).json({ url: data.signedUrl });
  } catch (e: any) {
    return res.status(e?.status || 500).json({ error: e?.message || "Server error" });
  }
}
