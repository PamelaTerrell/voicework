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
      console.log("SEARCH:", window.location.search);
      console.log("HASH:", window.location.hash);
      console.log("CODE:", code);
      console.log("NEXT:", next);

      // If the user is already signed in, don't fail just because there's no code
      const { data: sessionData } = await supabase.auth.getSession();
      const existingSession = sessionData.session;

      if (existingSession) {
        if (!isMounted) return;
        setStatus("You’re already signed in. Redirecting...");
        navigate(next, { replace: true });
        return;
      }

      // PKCE flow: exchange the auth code for a session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!isMounted) return;

        if (error) {
          console.error("Auth callback error:", error);
          setStatus(`Auth error: ${error.message}`);
          return;
        }

        setStatus("Success! Redirecting to your library...");
        navigate(next, { replace: true });
        return;
      }

      // No session and no code means the callback URL didn't contain PKCE params
      setStatus(
        "No auth code was found, but this may be an implicit auth redirect. Please check the console for the full callback URL."
      );
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