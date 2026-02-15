import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const nav = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().finally(() => {
      nav("/members", { replace: true });
    });
  }, [nav]);

  return (
    <div className="p-6">
      Signing you in…
    </div>
  );
}
