import type { VercelRequest, VercelResponse } from "@vercel/node";
import { EPISODE_FILE_MAP, isApprovedEpisodeId } from "./_episodes.js";
import { reconcileAuthenticatedMembership } from "./_membership.js";
import { requireUser, supabaseAdmin } from "./_lib.js";
import { setApiResponseHeaders } from "./_responseHeaders.js";

const FREE_EPISODE_IDS = new Set(["say-sorry-ep3"]);

function authenticationError(error: unknown) {
  if (!(error instanceof Error)) return null;

  const status = (error as Error & { status?: number }).status;
  if (status !== 401) return null;

  return error.message.includes("Missing Authorization")
    ? "Authentication required."
    : "Authentication expired or invalid.";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiResponseHeaders(res, { varyAuthorization: true });

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);

    const episodeId =
      typeof req.query.episodeId === "string" ? req.query.episodeId : "";
    const requestedType = req.query.type;

    if (
      !episodeId ||
      !isApprovedEpisodeId(episodeId)
    ) {
      return res.status(404).json({ error: "Episode unavailable." });
    }

    if (
      requestedType !== undefined &&
      requestedType !== "full" &&
      requestedType !== "preview"
    ) {
      return res.status(400).json({ error: "Episode unavailable." });
    }

    const type = requestedType === "preview" ? "preview" : "full";
    const fileEntry = EPISODE_FILE_MAP[episodeId];

    if (
      type === "preview" &&
      (!fileEntry.preview || fileEntry.preview === fileEntry.full)
    ) {
      return res.status(404).json({ error: "Preview unavailable." });
    }

    let allowed = type === "preview" || FREE_EPISODE_IDS.has(episodeId);
    let membershipUnavailable = false;

    if (!allowed) {
      const membership = await reconcileAuthenticatedMembership(user);
      allowed = membership.active;
      membershipUnavailable =
        membership.outcome === "conflict" || membership.outcome === "unavailable";
    }

    if (!allowed) {
      const { data: entitlement, error: entitlementError } = await supabaseAdmin
        .from("entitlements")
        .select("id")
        .eq("user_id", user.id)
        .eq("episode_id", episodeId)
        .maybeSingle();

      if (entitlementError) {
        return res.status(500).json({ error: "Unable to authorize audio." });
      }

      allowed = !!entitlement?.id;
    }

    if (!allowed) {
      if (membershipUnavailable) {
        return res.status(503).json({ error: "Unable to authorize audio." });
      }
      return res.status(403).json({ error: "Access required." });
    }

    const path = fileEntry[type];

    if (!path) {
      return res.status(404).json({ error: "Episode unavailable." });
    }

    const { data, error } = await supabaseAdmin.storage
      .from("episodes")
      .createSignedUrl(path, 60 * 10);

    if (error || !data?.signedUrl) {
      return res.status(404).json({ error: "Episode unavailable." });
    }

    return res.status(200).json({ url: data.signedUrl });
  } catch (error: unknown) {
    const authMessage = authenticationError(error);

    if (authMessage) {
      return res.status(401).json({ error: authMessage });
    }

    return res.status(500).json({ error: "Unable to authorize audio." });
  }
}
