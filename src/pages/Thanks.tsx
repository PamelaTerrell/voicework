import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { sendMagicLink } from "@/lib/sendMagicLink";
import {
  getConfirmationAuthView,
  initialVerificationState,
  isVerifiedCheckoutState,
  resolveVerificationState,
  type ConfirmationAuthState,
  type CheckoutVerification,
  type VerificationState,
} from "@/lib/checkoutConfirmation";
import { clearSensitiveBrowserUrl } from "@/lib/safeNavigation";

type AnalyticsWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

function trackEvent(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  (window as AnalyticsWindow).gtag?.("event", eventName, {
    site: "stabileusa",
    page_name: "thanks",
    page_location: window.location.pathname,
    ...params,
  });
}

const COPY: Record<
  VerificationState,
  { eyebrow: string; title: string; description: string }
> = {
  verifying: {
    eyebrow: "Secure checkout",
    title: "Verifying your purchase",
    description: "Please wait while we confirm the checkout securely.",
  },
  verified_subscription: {
    eyebrow: "Membership verified",
    title: "Welcome, Night Listener",
    description:
      "Your subscription checkout is confirmed. Sign in to open the Night Listener library.",
  },
  verified_one_time: {
    eyebrow: "Purchase verified",
    title: "Your story is ready",
    description:
      "Your episode purchase is confirmed. Sign in to find it in your Night Listener library.",
  },
  pending: {
    eyebrow: "Payment processing",
    title: "Your checkout is still processing",
    description:
      "We have not confirmed the purchase yet. Please check again shortly before trying another payment.",
  },
  invalid: {
    eyebrow: "Unable to verify",
    title: "We could not verify this checkout",
    description:
      "Sign in with the account used for checkout, or contact support if you believe payment completed.",
  },
  direct: {
    eyebrow: "Night Listener",
    title: "Looking for your library?",
    description:
      "This page confirms completed checkouts. Sign in to visit your library or contact support for purchase help.",
  },
  failure: {
    eyebrow: "Verification unavailable",
    title: "We could not check your purchase",
    description:
      "Please try again shortly. If the problem continues, contact support without starting another payment.",
  },
};

const AUTHENTICATED_DESCRIPTION: Partial<Record<VerificationState, string>> = {
  verified_subscription:
    "Your membership is confirmed. Open the Night Listener library to start listening.",
  verified_one_time:
    "Your episode purchase is confirmed. Open the Night Listener library to start listening.",
};

export default function Thanks() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [verificationState, setVerificationState] =
    useState<VerificationState>(initialVerificationState(sessionId));
  const [authState, setAuthState] =
    useState<ConfirmationAuthState>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [message, setMessage] = useState("");
  const successTracked = useRef(false);
  const verifiedCheckout = useRef(false);

  useEffect(() => {
    let active = true;
    let authEventObserved = false;

    function syncSession(nextSession: Session | null) {
      setSession(nextSession);
      setAuthState(nextSession?.access_token ? "authenticated" : "signed_out");
    }

    supabase.auth.getSession().then(
      ({ data, error }) => {
        if (!active || authEventObserved) return;
        syncSession(error ? null : data.session);
      },
      () => {
        if (active && !authEventObserved) syncSession(null);
      },
    );

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;
        authEventObserved = true;
        syncSession(nextSession);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setVerificationState("direct");
      return;
    }

    const checkoutSessionId = sessionId;
    clearSensitiveBrowserUrl();

    if (authState === "checking" || verifiedCheckout.current) {
      return;
    }

    const token = session?.access_token;
    if (!token) {
      setVerificationState("invalid");
      return;
    }

    let cancelled = false;

    async function verifyCheckout() {
      try {
        const response = await fetch(
          `/api/checkout-session?session_id=${encodeURIComponent(checkoutSessionId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const result = (await response.json()) as CheckoutVerification;

        if (cancelled) return;

        const nextState = resolveVerificationState(response.ok, result);

        if (isVerifiedCheckoutState(nextState)) {
          verifiedCheckout.current = true;
          setVerificationState(nextState);

          if (!successTracked.current) {
            successTracked.current = true;
            trackEvent("checkout_verified", {
              purchase_type: result.purchaseType,
            });
          }
          return;
        }

        setVerificationState(nextState);
      } catch {
        if (!cancelled) setVerificationState("failure");
      }
    }

    setVerificationState("verifying");
    void verifyCheckout();

    return () => {
      cancelled = true;
    };
  }, [authState, session?.access_token, sessionId]);

  async function handleSendMagicLink() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessage("Enter the email address associated with your account.");
      return;
    }

    try {
      setSendingLink(true);
      setMessage("");

      const { error } = await sendMagicLink(trimmedEmail);

      setMessage(
        error
          ? "We could not send a sign-in link. Please try again."
          : "Your sign-in link is on its way. Please check your email.",
      );
    } catch {
      setMessage("We could not send a sign-in link. Please try again.");
    } finally {
      setSendingLink(false);
    }
  }

  const copy = COPY[verificationState];
  const verified = isVerifiedCheckoutState(verificationState);
  const authView = getConfirmationAuthView(verificationState, authState);
  const description = authView.showAuthenticatedCopy
    ? AUTHENTICATED_DESCRIPTION[verificationState] ?? copy.description
    : copy.description;

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-[#2d2a26]">
      <div className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <Card className="w-full overflow-hidden rounded-[2rem] border border-[#e8e4dc] bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <CardContent className="px-8 py-14 text-center sm:px-12">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-[#e8e4dc] bg-[#f9f7fc] text-xl shadow-sm">
              🌙
            </div>

            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#9a90b0]">
              {copy.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-4 text-base leading-7 text-[#6b645c] sm:text-lg">
              {description}
            </p>

            {verificationState === "verifying" ? (
              <p className="mt-8 text-sm text-[#8a8175]">Checking securely…</p>
            ) : (
              <div className="mt-8 space-y-4">
                {verified && (
                  <Button asChild className="h-12 rounded-xl bg-[#2d2a26] px-6 text-white">
                    <Link to="/members">Open Members Library</Link>
                  </Button>
                )}

                {authView.showAuthLoading && (
                  <p className="text-sm text-[#8a8175]">
                    Checking your secure sign-in…
                  </p>
                )}

                {authView.showSignInForm && (
                  <div className="space-y-3 text-left">
                    <label
                      htmlFor="account-email"
                      className="block text-sm font-medium"
                    >
                      Account email
                    </label>
                    <Input
                      id="account-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Enter your email"
                      autoComplete="email"
                      className="h-12 rounded-xl border-[#d8cfc4] bg-white"
                    />
                    <Button
                      type="button"
                      onClick={handleSendMagicLink}
                      disabled={sendingLink}
                      className="h-12 rounded-xl bg-[#2d2a26] px-6 text-white"
                    >
                      {sendingLink
                        ? "Sending sign-in link…"
                        : "Email me a sign-in link"}
                    </Button>
                    {message && (
                      <p className="text-sm leading-6 text-[#6b645c]">
                        {message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-10 flex flex-wrap justify-center gap-4 text-sm text-[#8a8175]">
              <Link to="/members" className="hover:text-[#2d2a26]">
                Member library
              </Link>
              <Link to="/listen" className="hover:text-[#2d2a26]">
                Browse stories
              </Link>
              <Link to="/contact" className="hover:text-[#2d2a26]">
                Contact support
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
