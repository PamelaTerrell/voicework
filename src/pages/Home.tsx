import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMagicLink } from "@/lib/sendMagicLink";

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
      const { error } = await sendMagicLink(email);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "Magic link sent. Check your email and use the same address you used for membership."
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
            <div className="space-y-6">
              <div className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
               Night Listener • Human behavior • Story-driven audio
              </div>

              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
  Story-driven reflections on{" "}
  <span className="bg-gradient-to-r from-[#b49a7a] to-[#8f7a60] bg-clip-text text-transparent">
    human behavior, relationships, and the moments we replay
  </span>
  .
</h1>

              <p className="max-w-xl text-sm italic leading-7 text-muted-foreground/90">
  For the conversations you replay, the things you didn’t say, and the moments that stay with you longer than expected.
</p>
            </div>

            <p className="text-lg text-muted-foreground">
  Start with one full story free, then explore a growing library of calm, thoughtful audio stories about emotional patterns, social behavior, and the quiet dynamics behind everyday life.
</p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild className="h-11 px-6">
                <a href="#featured-story">Listen to the free story</a>
              </Button>

              <Button asChild variant="outline" className="h-11 px-6">
                <Link to="/join">Unlock the full library</Link>
              </Button>

              <Button asChild variant="secondary" className="h-11 px-6">
                <Link to="/listen">Hear more previews</Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              One full story free • Full library for members • Calm storytelling voice • Sociology-informed perspective
            </p>
          </div>

          <div className="space-y-4">
            <div
              id="featured-story"
              className="rounded-2xl border bg-background p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Start here</p>
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  Free full episode
                </span>
              </div>

              <img
                src="/images/say-sorry.png"
                alt="You Were Right… But You Never Said Sorry"
                className="mb-4 h-48 w-full rounded-xl object-cover"
              />

              <p className="mt-1 text-xl font-medium">
                You Were Right… But You Never Said Sorry
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                A quiet story about being right, holding back an apology, and the kind of moment people replay long after it happens.
              </p>

              <div className="mt-4 space-y-2">
                <audio controls preload="metadata" className="w-full">
                  <source src="/audio/say-sorry-ep3.mp3" type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Your free full story</span>
                  <Link
                    to="/join"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    Continue into the full library →
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted p-5">
              <p className="text-sm font-medium">Member login</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Already a member? Sign in with your email to open your full Night
                Listener library.
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
                <div className="mt-4 space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Welcome in.</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Enter your email to receive your private access link.
                    </p>
                  </div>

                  <div className="space-y-3">
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
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">Start with one full story free</p>
            <p className="text-sm text-muted-foreground">
              Listen to a complete episode first, so you can feel the tone,
              pacing, and emotional pull before joining.
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">Stories that stay with you</p>
            <p className="text-sm text-muted-foreground">
              Each story explores familiar emotions, unfinished conversations,
              and the quiet patterns behind human behavior.
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">A growing members-only library</p>
            <p className="text-sm text-muted-foreground">
              Membership unlocks the full Night Listener collection, with more
              thoughtful stories to return to whenever you want something calm,
              curious, and deeply human.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-3xl border bg-background p-6 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-lg font-medium">
              Ready for the full Night Listener experience?
            </p>
            <p className="text-sm text-muted-foreground">
              Begin with the free story, explore more previews, or unlock the
              full library with membership.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/join">Unlock membership</Link>
            </Button>

            <Button asChild variant="outline">
              <Link to="/listen">More previews</Link>
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