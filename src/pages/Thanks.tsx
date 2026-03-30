import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function trackEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", eventName, {
      site: "stabileusa",
      page_name: "thanks",
      page_location: window.location.pathname,
      ...params,
    });
  }
}

export default function Thanks() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [loadingEmail, setLoadingEmail] = useState(true);
  const [sendingLink, setSendingLink] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    trackEvent("membership_success", {
      plan: "monthly_membership",
      value: 4.99,
    });
  }, []);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      setLoadingEmail(false);
      return;
    }

    async function loadCheckoutEmail() {
      try {
        const res = await fetch(
          `/api/checkout-session?session_id=${encodeURIComponent(sessionId)}`
        );
        const data = await res.json();

        if (res.ok && data.email) {
          setEmail(data.email);

          trackEvent("thanks_checkout_email_prefilled", {
            has_session_id: true,
          });
        }
      } catch (error) {
        console.error("Could not load checkout email:", error);
      } finally {
        setLoadingEmail(false);
      }
    }

    loadCheckoutEmail();
  }, [searchParams]);

  async function handleSendMagicLink() {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setMessage("Please enter the email address you used during checkout.");
      return;
    }

    try {
      setSendingLink(true);
      setMessage("");

      const redirectTo = `${window.location.origin}/auth/callback?next=/members`;

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setMessage(error.message);
        trackEvent("thanks_magic_link_error", {
          error_message: error.message,
        });
        return;
      }

      setMessage("Your magic link is on its way. Please check your email.");

      trackEvent("thanks_magic_link_sent", {
        email_prefilled: !!searchParams.get("session_id"),
      });
    } catch (error) {
      console.error("Magic link error:", error);
      setMessage("Something went wrong sending your magic link.");
    } finally {
      setSendingLink(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-[#2d2a26]">
      <div className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <Card className="w-full overflow-hidden rounded-[2rem] border border-[#e8e4dc] bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-sm">
          <CardContent className="px-8 py-14 text-center sm:px-12">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-[#e8e4dc] bg-[#f9f7fc] text-xl shadow-sm">
              🌙
            </div>

            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#9a90b0]">
              You’re in
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Welcome, Night Listener
            </h1>

            <p className="mt-4 text-base leading-7 text-[#6b645c] sm:text-lg">
              You now have full access to the Night Listener library—
              a collection of stories about the moments, emotions, and patterns
              we all recognize.
            </p>

            <div className="mt-6 rounded-2xl border border-[#d8cfc4] bg-[#fdfaf3] px-5 py-4 text-left shadow-sm">
              <p className="text-sm leading-6 text-[#5c554d] sm:text-base">
                <span className="font-medium text-[#4b3f2f]">Note:</span>{" "}
                To begin listening, sign in using the same email address you used
                during checkout. Your magic link will be sent there so you can
                access your membership.
              </p>
            </div>

            <div className="mt-6 space-y-3 text-left">
              <label
                htmlFor="checkout-email"
                className="block text-sm font-medium text-[#4b3f2f]"
              >
                Checkout email
              </label>

              <Input
                id="checkout-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  loadingEmail
                    ? "Loading your checkout email..."
                    : "Enter your email"
                }
                className="h-12 rounded-xl border-[#d8cfc4] bg-white"
                autoComplete="email"
              />

              <Button
                type="button"
                onClick={handleSendMagicLink}
                disabled={sendingLink || loadingEmail}
                className="h-12 rounded-xl bg-[#2d2a26] px-6 text-white shadow-[0_10px_24px_rgba(45,42,38,0.12)] transition hover:bg-[#1f1c19]"
              >
                {sendingLink ? "Sending magic link..." : "Email me my magic link"}
              </Button>

              {message && (
                <p className="text-sm leading-6 text-[#6b645c]">{message}</p>
              )}
            </div>

            <div className="mx-auto mt-8 h-px w-20 bg-gradient-to-r from-transparent via-[#d8cfc4] to-transparent" />

            <p className="mx-auto mt-6 max-w-md text-sm leading-7 text-[#8a8175]">
              Start anywhere. Follow what feels familiar.
              The next story might feel closer than you expect.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-[#2d2a26] px-8 text-white shadow-[0_10px_24px_rgba(45,42,38,0.12)] transition hover:bg-[#1f1c19]"
              >
                <Link
                  to="/members"
                  onClick={() =>
                    trackEvent("thanks_nav_click", {
                      destination: "/members",
                      cta_label: "Start Listening",
                    })
                  }
                >
                  Start listening
                </Link>
              </Button>

              <Link
                to="/listen"
                className="text-sm text-[#8a8175] transition hover:text-[#2d2a26]"
                onClick={() =>
                  trackEvent("thanks_nav_click", {
                    destination: "/listen",
                    cta_label: "Browse Stories",
                  })
                }
              >
                or explore more stories first
              </Link>
            </div>

            <div className="mt-8">
              <Link
                to="/"
                className="text-xs text-[#8a8175] transition hover:text-[#2d2a26]"
              >
                Back to home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}