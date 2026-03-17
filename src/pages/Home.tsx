import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


export default function Home() {
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

    try {
      const redirectTo =
        window.location.hostname === "localhost"
          ? "http://localhost:5173/auth/callback?next=/members"
          : "https://www.stabileusa.com/auth/callback?next=/members";

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

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
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-3xl border bg-background p-6 sm:p-10">
        <div className="pointer-events-none absolute -top-24 right-[-6rem] h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-[-6rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <div className="w-fit rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
              Cozy late-night listening • Human behavior • Sociology-inspired
            </div>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Calm bedtime stories about{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                why we do what we do
              </span>
              .
            </h1>

            <p className="text-lg text-muted-foreground">
              Gentle, story-driven reflections on human behavior—made for winding down,
              getting curious, and feeling a little less alone at night.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild className="h-11 px-6">
                <Link to="/listen">Play a free preview</Link>
              </Button>

              <Button asChild variant="outline" className="h-11 px-6">
                <Link to="/join">Join the Night List</Link>
              </Button>

              <Button asChild variant="secondary" className="h-11 px-6">
                <Link to="/members">Members</Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              New episodes coming regularly • Calm bedtime voice • BA in Sociology
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border bg-background p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Tonight’s preview</p>
              <p className="mt-1 text-xl font-medium">
                The Conversation That Never Finished
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                A quiet late-night story about misunderstanding, belief, and the words
                we never get the chance to finish.
              </p>

              <div className="mt-4 space-y-2">
                <audio controls preload="metadata" className="w-full">
                  <source src="/audio/conversation-preview.mp3" type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Free 3-minute preview</span>
                  <Link
                    to="/listen"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    More previews →
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted p-5">
              <p className="text-sm font-medium">Member login</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Already subscribed or unlocked an episode? Sign in with your email to
                access your full episodes.
              </p>

              {sessionEmail ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Signed in as{" "}
                    <span className="font-medium text-foreground">
                      {sessionEmail}
                    </span>
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="w-full sm:w-auto">
                      <Link to="/members">Go to Members</Link>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={signOut}
                    >
                      Sign out
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl bg-background"
                  />

                  <Button
                    onClick={sendLink}
                    disabled={!email || loading}
                    className="w-full sm:w-auto"
                  >
                    {loading ? "Sending…" : "Send magic link"}
                  </Button>

                  {message && (
                    <p className="text-xs text-muted-foreground">{message}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">Cozy late-night tone</p>
            <p className="text-sm text-muted-foreground">
              Calm, unhurried narration designed for bedtime listening—gentle pacing and
              a soft landing.
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">Sociology-inspired insight</p>
            <p className="text-sm text-muted-foreground">
              Human behavior explained through stories and everyday examples—curious,
              comforting, and easy to follow.
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">A growing library</p>
            <p className="text-sm text-muted-foreground">
              Short previews now, full episodes for members. Join the Night List to get
              new releases and early access.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-3xl border bg-background p-6 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-lg font-medium">Want new episodes in your inbox?</p>
            <p className="text-sm text-muted-foreground">
              Join the Night List for release notes, early access, and founding-listener perks.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/join">Join the Night List</Link>
            </Button>

            <Button asChild variant="outline">
              <Link to="/listen">Listen</Link>
            </Button>

            <Button asChild variant="secondary">
              <Link to="/members">Members</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}