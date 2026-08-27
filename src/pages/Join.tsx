import { Link } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { sendMagicLink } from "@/lib/sendMagicLink";
import {
  getJoinMembershipView,
  verifyJoinMembership,
  type JoinMembershipState,
} from "@/lib/joinMembership";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Join() {
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [message, setMessage] = useState("");
  const [membershipState, setMembershipState] =
    useState<JoinMembershipState>("checking");
  const membershipRequest = useRef(0);

  const syncMembership = useCallback(async (session: Session | null) => {
    const requestId = membershipRequest.current + 1;
    membershipRequest.current = requestId;
    setSessionEmail(session?.user.email ?? null);
    setCheckoutMessage("");

    if (!session?.access_token) {
      setMembershipState("signed_out");
      return;
    }

    setMembershipState("checking");
    const verifiedState = await verifyJoinMembership(session.access_token);
    if (membershipRequest.current === requestId) {
      setMembershipState(verifiedState);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initialRequest = membershipRequest.current;

    supabase.auth.getSession().then(
      ({ data, error }) => {
        if (!active || membershipRequest.current !== initialRequest) {
          return;
        }
        if (error) {
          setMembershipState("verification_error");
          return;
        }
        void syncMembership(data.session);
      },
      () => {
        if (active && membershipRequest.current === initialRequest) {
          setMembershipState("verification_error");
        }
      },
    );

    const { data: sub } =
      supabase.auth.onAuthStateChange((_event, session) => {
        if (active) {
          void syncMembership(session);
        }
      });

    return () => {
      active = false;
      membershipRequest.current += 1;
      sub.subscription.unsubscribe();
    };
  }, [syncMembership]);

  async function handleSendLink() {
    setLoading(true);
    setMessage("");

    try {
      const { error } = await sendMagicLink(email, "/join");

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "Magic link sent. Check your email to continue.",
      );

      setEmail("");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    membershipRequest.current += 1;
    await supabase.auth.signOut();
    setSessionEmail(null);
    setMembershipState("signed_out");
    setMessage("");
    setCheckoutMessage("");
  }

  async function retryMembershipCheck() {
    const requestId = membershipRequest.current + 1;
    membershipRequest.current = requestId;
    setMembershipState("checking");

    try {
      const { data, error } = await supabase.auth.getSession();
      if (membershipRequest.current !== requestId) {
        return;
      }
      if (error) {
        setMembershipState("verification_error");
        return;
      }
      await syncMembership(data.session);
    } catch {
      if (membershipRequest.current === requestId) {
        setMembershipState("verification_error");
      }
    }
  }

  async function handleSubscribe() {
    setCheckoutMessage("");

    if (membershipState !== "inactive") {
      setCheckoutMessage("Unable to start secure checkout.");
      return;
    }

    setCheckoutLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setSessionEmail(null);
        setMembershipState("signed_out");
        setCheckoutMessage(
          "Sign in with your email below before starting secure checkout.",
        );
        return;
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "subscription" }),
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !result.url) {
        setCheckoutMessage(result.error || "Unable to start secure checkout.");
        return;
      }

      window.location.assign(result.url);
    } catch {
      setCheckoutMessage("Unable to start secure checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  const membershipView = getJoinMembershipView(membershipState);

  return (
    <section className="w-full bg-[#02060b] text-white">
      <div
        className="
          mx-auto
          w-full
          max-w-[1600px]
          px-5
          py-14

          sm:px-8
          sm:py-18

          lg:px-12
          lg:py-20

          xl:px-16
          2xl:px-20
        "
      >
        {/* ======================================================
            PAGE INTRO
        ====================================================== */}

        <div className="mx-auto max-w-5xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d7af65]">
            Night Listener Membership
          </p>

          <h1
            className="
              mt-5
              text-3xl
              font-medium
              leading-[1.08]
              tracking-[-0.035em]

              sm:text-4xl
              lg:text-5xl
            "
          >
            Join Night Listener
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-400 sm:text-lg">
            Unlock the complete Night Listener library and
            return whenever you want something thoughtful,
            calm, intimate, and deeply human.
          </p>

          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3 text-xs text-slate-500">
            <span className="rounded-full border border-white/10 bg-white/[0.025] px-4 py-2">
              Full story library
            </span>

            <span className="rounded-full border border-white/10 bg-white/[0.025] px-4 py-2">
              $4.99 / month
            </span>

            <span className="rounded-full border border-white/10 bg-white/[0.025] px-4 py-2">
              Secure Stripe checkout
            </span>

            <span className="rounded-full border border-white/10 bg-white/[0.025] px-4 py-2">
              Magic-link access
            </span>
          </div>
        </div>

        {/* ======================================================
            MEMBERSHIP + MEMBER SIGN IN
        ====================================================== */}

        <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:items-stretch">
          {/* MEMBERSHIP */}

          <Card className="h-full rounded-[2rem] border-white/10 bg-[#07101a] text-white shadow-[0_30px_90px_rgba(0,0,0,.28)]">
            <CardContent className="flex h-full flex-col p-6 sm:p-8 lg:p-10">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d7af65]">
                  Membership
                </p>

                <h2 className="mt-4 text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
                  Unlock the full library
                </h2>

                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                  Night Listener membership gives you access
                  to the complete collection of story-driven
                  reflections on relationships, human
                  behavior, emotional patterns, memory, and
                  the moments people continue carrying.
                </p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-white">
                    Full access
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Listen to the complete Night Listener
                    library whenever you want.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-white">
                    Simple membership
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    One monthly subscription with secure
                    checkout powered by Stripe.
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-8">
                {membershipView.showMagicLink && (
                  <div className="rounded-2xl border border-[#d7af65]/25 bg-[#d7af65]/[0.06] p-5">
                    <p className="text-sm font-medium text-white">
                      Sign in first, then continue to secure checkout.
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-400">
                      Use the magic-link form to verify your email before joining.
                    </p>
                  </div>
                )}

                {membershipView.showChecking && (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <p className="text-sm font-medium text-white">
                      Checking your membership…
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-500">
                      We’re securely verifying your current access.
                    </p>
                  </div>
                )}

                {membershipView.showCheckout && (
                  <div>
                    <Button
                      type="button"
                      onClick={handleSubscribe}
                      disabled={checkoutLoading}
                      className="
                        h-12
                        w-full
                        rounded-full
                        bg-[#d7af65]
                        text-black
                        hover:bg-[#e7ca90]
                      "
                    >
                      {checkoutLoading
                        ? "Opening secure checkout…"
                        : "Join Night Listener — $4.99/month"}
                    </Button>

                    {checkoutMessage && (
                      <p className="mt-3 text-center text-xs leading-6 text-slate-400">
                        {checkoutMessage}
                      </p>
                    )}

                    <p className="mt-4 text-center text-xs leading-6 text-slate-600">
                      Opens secure Stripe checkout. A receipt will be sent to your email.
                    </p>
                  </div>
                )}

                {membershipView.showMembersLibrary && (
                  <div className="rounded-2xl border border-[#d7af65]/25 bg-[#d7af65]/[0.06] p-5">
                    <p className="text-lg font-medium text-white">
                      Your membership is active
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-400">
                      Your full Night Listener library is ready.
                    </p>
                    <Button
                      asChild
                      className="mt-4 rounded-full bg-[#d7af65] text-black hover:bg-[#e7ca90]"
                    >
                      <Link to="/members">Open Members Library</Link>
                    </Button>
                  </div>
                )}

                {membershipView.showVerificationError && (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <p className="text-sm font-medium text-white">
                      We couldn’t verify your membership.
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-500">
                      Please try the secure membership check again.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={retryMembershipCheck}
                      className="mt-4 rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    >
                      Retry membership check
                    </Button>
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-white">
                    Not ready to subscribe?
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Start with the free full story on the
                    Night Listener listening page and get a feel for
                    Night Listener first.
                  </p>

                  <Button
                    asChild
                    variant="outline"
                    className="mt-4 rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link to="/listen">
                      Listen to the free story
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MEMBER SIGN IN */}

          <Card className="h-full rounded-[2rem] border-white/10 bg-[#07101a] text-white shadow-[0_30px_90px_rgba(0,0,0,.28)]">
            <CardContent className="flex h-full flex-col p-6 sm:p-8 lg:p-10">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d7af65]">
                  Member Access
                </p>

                <h2 className="mt-4 text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
                  Sign in to continue
                </h2>

                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                  Use your email to verify an existing membership or continue to the joining step.
                </p>
              </div>

              <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
                {membershipView.showMagicLink ? (
                  <div>
                    <label
                      htmlFor="member-email"
                      className="text-sm font-medium text-white"
                    >
                      Email address
                    </label>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <Input
                        id="member-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) =>
                          setEmail(e.target.value)
                        }
                        className="
                          h-11
                          flex-1
                          border-white/10
                          bg-[#03070d]
                          text-white
                          placeholder:text-slate-700
                        "
                      />

                      <Button
                        onClick={handleSendLink}
                        disabled={!email || loading}
                        className="
                          h-11
                          shrink-0
                          rounded-full
                          bg-[#d7af65]
                          px-6
                          text-black
                          hover:bg-[#e7ca90]
                        "
                      >
                        {loading
                          ? "Sending…"
                          : "Send magic link"}
                      </Button>
                    </div>

                    {message && (
                      <p className="mt-3 text-xs leading-6 text-slate-500">
                        {message}
                      </p>
                    )}
                  </div>
                ) : sessionEmail ? (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-600">
                        Signed in
                      </p>

                      <p className="mt-2 break-all text-sm text-slate-400">
                        <span className="font-medium text-white">
                          {sessionEmail}
                        </span>
                      </p>
                    </div>

                    <div>
                      <Button
                        variant="outline"
                        onClick={signOut}
                        className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      >
                        Sign out
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-7 text-slate-500">
                    Checking your secure sign-in…
                  </p>
                )}
              </div>

              <div className="mt-auto pt-8">
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <p className="text-sm font-medium text-white">
                    How access works
                  </p>

                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    There is no password to remember. Your
                    private access link is sent directly to
                    your membership email address.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ======================================================
            CONTACT
        ====================================================== */}

        <div className="mt-8 text-center text-sm text-slate-500">
          Prefer email?{" "}
          <a
            className="text-[#d7af65] underline underline-offset-4 transition hover:text-[#efd296]"
            href="mailto:listen@stabileusa.com?subject=Night%20List"
          >
            Send a quick note
          </a>
          .
        </div>
      </div>
    </section>
  );
}
