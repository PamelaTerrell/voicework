import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateAuthenticatedMembership } from "./_membership.js";
import { requireUser, supabaseAdmin } from "./_lib.js";

const FREE_EPISODE_IDS = new Set(["say-sorry-ep3"]);

const EPISODE_FILE_MAP: Record<
  string,
  { preview: string | null; full: string }
> = {
  "versions-ep5": {
    preview: "never-meant-to-see-ep5/preview.mp3",
    full: "versions-ep5/full.mp3",
  },
  "conversation-ep2": {
    preview: null,
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
  "im-fine-ep6": {
    preview: null,
    full: "im-fine-ep6/full.mp3",
  },
  "lonely-night-ep7": {
    preview: "lonely-night-ep7/preview.mp3",
    full: "lonely-night-ep7/full.mp3",
  },
  "lonely-night-part2-ep8": {
    preview: "lonely-night-part2-ep8/preview.mp3",
    full: "lonely-night-part2-ep8/full.mp3",
  },
  "had-everything-part1-ep9": {
    preview: null,
    full: "had-everything-part1-ep9/full.mp3",
  },
  "had-everything-part2-ep10": {
    preview: null,
    full: "had-everything-part2-ep10/full.mp3",
  },
  "never-made-you-guess-ep11": {
    preview: null,
    full: "never-made-you-guess-ep11/full.mp3",
  },
  "the-hardest-people-ep12": {
    preview: null,
    full: "the-hardest-people-ep12/full.mp3",
  },
  "life-you-didnt-get-ep13": {
    preview: null,
    full: "life-you-didnt-get-ep13/full.mp3",
  },
  "toast-ep14": {
    preview: null,
    full: "toast-ep14/full.mp3",
  },
  "love-him-anyway-15": {
    preview: null,
    full: "love-him-anyway-15/full.mp3",
  },
};

function authenticationError(error: unknown) {
  if (!(error instanceof Error)) return null;

  const status = (error as Error & { status?: number }).status;
  if (status !== 401) return null;

  return error.message.includes("Missing Authorization")
    ? "Authentication required."
    : "Authentication expired or invalid.";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      !Object.prototype.hasOwnProperty.call(EPISODE_FILE_MAP, episodeId)
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

    if (!allowed) {
      const membership = await validateAuthenticatedMembership(user);
      allowed = membership.active;
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
