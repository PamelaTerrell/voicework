import { supabase } from "@/lib/supabaseClient";

export type MagicLinkDestination = "/members" | "/join";

const DEFAULT_MAGIC_LINK_DESTINATION: MagicLinkDestination = "/members";
const TRUSTED_MAGIC_LINK_DESTINATIONS = new Set<MagicLinkDestination>([
  DEFAULT_MAGIC_LINK_DESTINATION,
  "/join",
]);

export function getMagicLinkRedirectTo(
  hostname: string,
  destination: MagicLinkDestination = DEFAULT_MAGIC_LINK_DESTINATION,
  previewSiteUrl?: string,
): string {
  const safeDestination = TRUSTED_MAGIC_LINK_DESTINATIONS.has(destination)
    ? destination
    : DEFAULT_MAGIC_LINK_DESTINATION;
  let origin = "https://www.stabileusa.com";
  if (hostname === "localhost") {
    origin = "http://localhost:5173";
  } else if (hostname !== "www.stabileusa.com" && hostname !== "stabileusa.com" && previewSiteUrl !== undefined) {
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/.test(hostname) ||
        previewSiteUrl !== `https://${hostname}`) {
      throw new Error("Open this preview on its configured host to sign in.");
    }
    origin = previewSiteUrl;
  }

  return `${origin}/auth/callback?next=${safeDestination}`;
}

export async function sendMagicLink(
  email: string,
  destination: MagicLinkDestination = DEFAULT_MAGIC_LINK_DESTINATION,
) {
  const redirectTo = getMagicLinkRedirectTo(
    window.location.hostname,
    destination,
    import.meta.env.VITE_PREVIEW_SITE_URL,
  );

  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });
}
