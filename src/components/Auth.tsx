import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { track } from "@vercel/analytics";
import { supabase } from "@/lib/supabaseClient";
import { sendMagicLink } from "@/lib/sendMagicLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Auth() {
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendLink() {
    setLoading(true);
    setMessage("");

    // Do not send the visitor's email address to analytics.
    track("Magic Link Requested", {
      location: "site-header",
    });

    try {
      const { error } = await sendMagicLink(email);

      if (error) {
        track("Magic Link Failed", {
          location: "site-header",
          reason: "request-rejected",
        });

        setMessage("We could not send a sign-in link. Please try again.");
        return;
      }

      track("Magic Link Sent", {
        location: "site-header",
      });

      setMessage(
        "Magic link sent. Check your email and use the same address you used for Stripe."
      );

      setEmail("");
    } catch {
      track("Magic Link Failed", {
        location: "site-header",
        reason: "Unexpected error",
      });

      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    track("Member Signed Out", {
      location: "site-header",
    });

    await supabase.auth.signOut();
    setMessage("");
  }

  if (sessionEmail) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="max-w-[220px] truncate text-sm text-muted-foreground">
          {sessionEmail}
        </div>

        <Button asChild variant="outline" className="rounded-xl">
          <Link
            to="/members"
            onClick={() =>
              track("Members Page Clicked", {
                location: "authenticated-header",
              })
            }
          >
            Members
          </Link>
        </Button>

        <Button
          variant="secondary"
          className="rounded-xl"
          onClick={signOut}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
      <Input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && email && !loading) {
            void sendLink();
          }
        }}
        className="w-64 rounded-xl"
      />

      <Button
        onClick={sendLink}
        disabled={!email || loading}
        className="rounded-xl"
      >
        {loading ? "Sending…" : "Send magic link"}
      </Button>

      {message && (
        <p
          className="w-full text-right text-xs text-muted-foreground sm:text-left"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </div>
  );
}
