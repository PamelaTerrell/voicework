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
): string {
  const safeDestination = TRUSTED_MAGIC_LINK_DESTINATIONS.has(destination)
    ? destination
    : DEFAULT_MAGIC_LINK_DESTINATION;
  const origin =
    hostname === "localhost"
      ? "http://localhost:5173"
      : "https://www.stabileusa.com";

  return `${origin}/auth/callback?next=${safeDestination}`;
}

export async function sendMagicLink(
  email: string,
  destination: MagicLinkDestination = DEFAULT_MAGIC_LINK_DESTINATION,
) {
  const redirectTo = getMagicLinkRedirectTo(
    window.location.hostname,
    destination,
  );

  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });
}
