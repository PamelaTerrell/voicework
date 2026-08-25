import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import {
  clearSensitiveBrowserUrl,
  resolveAuthDestination,
} from "@/lib/safeNavigation";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Finishing sign-in...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function finishAuth() {
      const next = resolveAuthDestination(searchParams.getAll("next"));
      const code = searchParams.get("code");

      // If the user is already signed in, don't fail just because there's no code
      const { data: sessionData } = await supabase.auth.getSession();
      const existingSession = sessionData.session;

      if (existingSession) {
        if (!isMounted) return;
        clearSensitiveBrowserUrl();
        setStatus("You’re already signed in. Redirecting...");
        navigate(next, { replace: true });
        return;
      }

      // PKCE flow: exchange the auth code for a session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!isMounted) return;

        if (error) {
          clearSensitiveBrowserUrl();
          setFailed(true);
          setStatus("We could not complete your sign-in. Please request a new sign-in link and try again.");
          return;
        }

        clearSensitiveBrowserUrl();
        setStatus("Success! Redirecting to your library...");
        navigate(next, { replace: true });
        return;
      }

      // No session and no code means the callback URL didn't contain PKCE params
      clearSensitiveBrowserUrl();
      setFailed(true);
      setStatus("This sign-in link is incomplete or has expired. Please request a new link and try again.");
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
        {failed && (
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
            <Link className="underline" to="/members">Try member sign-in again</Link>
            <Link className="underline" to="/contact">Contact support</Link>
          </div>
        )}
      </div>
    </div>
  );
}
