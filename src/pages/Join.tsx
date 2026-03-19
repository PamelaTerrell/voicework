import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { sendMagicLink } from "@/lib/sendMagicLink";

const FORM_ENDPOINT = "https://formspree.io/f/xykjjvdb";

const STRIPE_ONE_TIME_URL =
  "https://buy.stripe.com/fZu3cobIS08qh2N71p2cg03";

const STRIPE_SUBSCRIBE_URL =
  "https://buy.stripe.com/9B64gs7o5k53Pd2cg05";

export default function Join() {
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
        "Magic link sent. Check your email and use the same address you used for Stripe."
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
    <div className="max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Join</h1>
        <p className="text-muted-foreground">
          Full-length cozy bedtime episodes about human behavior — calm,
          story-driven, and designed for late-night listening.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Night Listener access</p>
            <p className="mt-1">
              Choose membership for the full library.
              Cancel anytime.
            </p>
          </div>

          <div className="space-y-3">
           <div className="space-y-3">
  <Button asChild className="w-full">
    <a href={STRIPE_SUBSCRIBE_URL} target="_blank" rel="noreferrer">
      Unlock the Full Night Listener Library — $4.99/month
    </a>
  </Button>

  <div className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
    <p className="font-medium text-foreground">
      Not ready to subscribe?
    </p>
    <p className="mt-1">
      You can listen to a full episode for free — no sign-up required.
    </p>
  </div>
</div>

           

            <p className="text-xs text-muted-foreground">
              Secure checkout powered by Stripe. You’ll receive a receipt by
              email.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Already subscribed?</p>
            <p className="mt-1">
              After checkout, sign in with the same email address you used in
              Stripe to unlock your member library and full episodes.
            </p>
          </div>

          {sessionEmail ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">
                  {sessionEmail}
                </span>
              </p>

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href="/members">Go to Members</a>
                </Button>

                <Button variant="outline" onClick={signOut}>
                  Sign out
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Member sign in</p>
                <p className="text-sm text-muted-foreground">
                  Enter the same email address you used in Stripe and we’ll send
                  your private access link.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sm:max-w-sm"
                />

                <Button
                  onClick={handleSendLink}
                  disabled={!email || loading}
                >
                  {loading ? "Sending…" : "Send magic link"}
                </Button>
              </div>

              {message && (
                <p className="text-xs text-muted-foreground">{message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="rounded-2xl border bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Night List (free)</p>
            <p className="mt-1">
              Want a heads-up when new episodes drop? Join the Night List for
              release notes and occasional cozy late-night updates.
            </p>
          </div>

          <form action={FORM_ENDPOINT} method="POST" className="space-y-4">
            <input
              type="hidden"
              name="_subject"
              value="Night List signup (stabileusa.com)"
            />
            <input type="hidden" name="type" value="night_list" />
            <input
              type="hidden"
              name="_next"
              value="https://www.stabileusa.com/thanks"
            />

            <input
              type="text"
              name="_gotcha"
              style={{ display: "none" }}
              tabIndex={-1}
              autoComplete="off"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="name">
                  Name (optional)
                </label>
                <Input id="name" name="name" placeholder="Your name" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="night-list-email">
                  Email
                </label>
                <Input
                  id="night-list-email"
                  name="email"
                  placeholder="you@example.com"
                  type="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="interest">
                What do you want more of? (optional)
              </label>
              <Input
                id="interest"
                name="interest"
                placeholder="Loneliness, belonging, social norms, identity, relationships…"
              />
            </div>

            <Button type="submit" variant="secondary" className="w-full">
              Join the Night List (free)
            </Button>

            <p className="text-xs text-muted-foreground">
              No spam. Just new episodes and occasional cozy notes.
            </p>
          </form>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        Prefer email?{" "}
        <a
          className="underline underline-offset-4 hover:text-foreground"
          href="mailto:agentpamelajterrell@gmail.com?subject=Night%20List"
        >
          Send a quick note
        </a>
        .
      </div>
    </div>
  );
}