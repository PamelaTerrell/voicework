import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sendMagicLink } from "@/lib/sendMagicLink";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FORM_ENDPOINT = "https://formspree.io/f/xykjjvdb";

const STRIPE_SUBSCRIBE_URL =
  "https://buy.stripe.com/9B64gs7sCg7o5k53Pd2cg05";

export default function Join() {
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });

    const { data: sub } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setSessionEmail(session?.user.email ?? null);
      });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSendLink() {
    setLoading(true);
    setMessage("");

    try {
      const { error } = await sendMagicLink(email);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "Magic link sent. Check your email and use the same address you used for membership.",
      );

      setEmail("");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMessage("");
  }

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
                <Button
                  asChild
                  className="
                    h-12
                    w-full
                    rounded-full
                    bg-[#d7af65]
                    text-black
                    hover:bg-[#e7ca90]
                  "
                >
                  <a
                    href={STRIPE_SUBSCRIBE_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Unlock the Full Library — $4.99/month
                  </a>
                </Button>

                <p className="mt-4 text-center text-xs leading-6 text-slate-600">
                  Secure checkout powered by Stripe. A receipt
                  will be sent to your email.
                </p>

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-white">
                    Not ready to subscribe?
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Start with the free full story on the
                    Stabile USA home page and get a feel for
                    Night Listener first.
                  </p>

                  <Button
                    asChild
                    variant="outline"
                    className="mt-4 rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link to="/">
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
                  Already subscribed?
                </h2>

                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                  Sign in with the same email address you used
                  for your membership and we&apos;ll send you
                  a private magic link.
                </p>
              </div>

              <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
                {sessionEmail ? (
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

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        asChild
                        className="rounded-full bg-[#d7af65] text-black hover:bg-[#e7ca90]"
                      >
                        <Link to="/members">
                          Open Members Library
                        </Link>
                      </Button>

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
                  <div>
                    <label
                      htmlFor="member-email"
                      className="text-sm font-medium text-white"
                    >
                      Membership email
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
            NIGHT LIST — FREE
        ====================================================== */}

        <div className="mt-8">
          <Card className="rounded-[2rem] border-white/10 bg-[#050a11] text-white shadow-[0_30px_90px_rgba(0,0,0,.22)]">
            <CardContent className="p-6 sm:p-8 lg:p-10">
              <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
                {/* INTRO */}

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d7af65]">
                    Free Night List
                  </p>

                  <h2 className="mt-4 text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
                    Want to hear when something new arrives?
                  </h2>

                  <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                    Join the free Night List for new episode
                    announcements, story updates, and
                    occasional thoughtful notes from Night
                    Listener.
                  </p>

                  <p className="mt-5 text-xs leading-6 text-slate-600">
                    No spam. Just new episodes and occasional
                    notes.
                  </p>
                </div>

                {/* FORM */}

                <form
                  action={FORM_ENDPOINT}
                  method="POST"
                  className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 sm:p-6"
                >
                  <input
                    type="hidden"
                    name="_subject"
                    value="Night List signup (stabileusa.com)"
                  />

                  <input
                    type="hidden"
                    name="type"
                    value="night_list"
                  />

                  <input
                    type="hidden"
                    name="_next"
                    value="https://stabileusa.com/contact-thanks"
                  />

                  <input
                    type="text"
                    name="_gotcha"
                    style={{ display: "none" }}
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium text-white"
                        htmlFor="name"
                      >
                        Name
                        <span className="ml-1 font-normal text-slate-600">
                          optional
                        </span>
                      </label>

                      <Input
                        id="name"
                        name="name"
                        placeholder="Your name"
                        className="border-white/10 bg-[#03070d] text-white placeholder:text-slate-700"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium text-white"
                        htmlFor="night-list-email"
                      >
                        Email
                      </label>

                      <Input
                        id="night-list-email"
                        name="email"
                        placeholder="you@example.com"
                        type="email"
                        required
                        className="border-white/10 bg-[#03070d] text-white placeholder:text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <label
                      className="text-sm font-medium text-white"
                      htmlFor="interest"
                    >
                      What do you want more of?
                      <span className="ml-1 font-normal text-slate-600">
                        optional
                      </span>
                    </label>

                    <Input
                      id="interest"
                      name="interest"
                      placeholder="Relationships, social behavior, emotional patterns, identity…"
                      className="border-white/10 bg-[#03070d] text-white placeholder:text-slate-700"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="
                      mt-5
                      h-11
                      w-full
                      rounded-full
                      bg-[#d7af65]
                      text-black
                      hover:bg-[#e7ca90]
                    "
                  >
                    Join the Night List — Free
                  </Button>
                </form>
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