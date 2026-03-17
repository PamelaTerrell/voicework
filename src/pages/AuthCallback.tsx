import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let isMounted = true;

    async function finishAuth() {
      const next = searchParams.get("next") || "/members";

      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (!isMounted) return;

      if (error) {
        console.error("Auth callback error:", error.message);
        navigate("/join", { replace: true });
        return;
      }

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
          Please wait while we finish your secure sign-in and take you to your
          listening library.
        </p>
      </div>
    </div>
  );
}