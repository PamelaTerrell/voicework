import { supabase } from "@/lib/supabaseClient";

export async function sendMagicLink(email: string) {
  const redirectTo =
    window.location.hostname === "localhost"
      ? "http://localhost:5173/auth/callback?next=/members"
      : "https://www.stabileusa.com/auth/callback?next=/members";

  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });
}
