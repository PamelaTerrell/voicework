import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Finishing sign-in...");

  useEffect(() => {
    let isMounted = true;

    async function finishAuth() {
      const next = searchParams.get("next") || "/members";
      const code = searchParams.get("code");

      console.log("FULL URL:", window.location.href);
      console.log("CODE:", code);
      console.log("NEXT:", next);

      // 🚨 DO NOT redirect away — show the issue instead
      if (!code) {
        const msg = "Missing auth code in callback URL.";
        console.error(msg);
        if (isMounted) setStatus(msg);
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!isMounted) return;

      if (error) {
        console.error("Auth callback error:", error);
        setStatus(`Auth error: ${error.message}`);
        return;
      }

      setStatus("Success! Redirecting to your library...");
      navigate(next, { replace: true });
    }

    finishAuth();

    return () => {
      isMounted = false;
    };
  }, [navigate, searchParams]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Signing you in…
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          {status}
        </p>
      </div>
    </div>
  );
}