import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const nav = useNavigate();

  useEffect(() => {
    async function finishAuth() {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        console.error("Auth callback error:", error.message);
        nav("/join", { replace: true });
        return;
      }

      nav("/members", { replace: true });
    }

    finishAuth();
  }, [nav]);

  return <div className="p-6">Signing you in…</div>;
}
