import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sendMagicLink } from "@/lib/sendMagicLink";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Episode = {
  id: string;
  title: string;
  description: string;
  thumbnailSrc?: string;
  previewMp3?: string;
  previewWav?: string;
  isMembersOnly?: boolean;
  tags?: string[];
  category?: string;
};

function stopOtherAudio(current: HTMLAudioElement) {
  document.querySelectorAll("audio").forEach((a) => {
    if (a !== current) a.pause();
  });
}

function trackEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", eventName, {
      site: "stabileusa",
      page_name: "listen",
      content_type: "episode",
      page_location: window.location.pathname,
      ...params,
    });
  }
}

function EpisodeCard({ episode }: { episode: Episode }) {
  const {
    id,
    title,
    description,
    thumbnailSrc,
    previewMp3,
    previewWav,
    isMembersOnly = false,
    tags = [],
    category = "general",
  } = episode;

  const [loading, setLoading] = useState(false);

  function onPreviewPlay() {
    trackEvent("preview_play", {
      episode_id: id,
      episode_title: title,
      episode_category: category,
    });
  }

  function onMembershipClick() {
    setLoading(true);

    trackEvent("membership_signup_click", {
      episode_id: id,
      episode_title: title,
      episode_category: category,
      value: 4.99,
      currency: "USD",
    });

    window.location.href = "/join";
  }

  return (
    <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      {thumbnailSrc && (
        <div className="relative overflow-hidden">
          <img
            src={thumbnailSrc}
            alt={title}
            className="h-56 w-full object-cover sm:h-64"
            loading="lazy"
          />
          <div className="absolute right-3 top-3">
            <Badge className="shadow-sm">
              {isMembersOnly ? "Preview + Members" : "Free"}
            </Badge>
          </div>
        </div>
      )}

      <CardContent className="space-y-5 p-6">
        <div className="space-y-3">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold leading-tight tracking-tight">
              {title}
            </h2>

            <p className="text-sm leading-7 text-muted-foreground">
              {description}
            </p>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {tags.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="rounded-full px-3 py-1 font-normal"
                >
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Preview</p>
            <Badge variant="secondary" className="font-normal">
              Free
            </Badge>
          </div>

          <audio
            controls
            preload="metadata"
            className="w-full"
            onPlay={(e) => {
              stopOtherAudio(e.currentTarget);
              onPreviewPlay();
            }}
          >
            {previewMp3 && <source src={previewMp3} type="audio/mpeg" />}
            {previewWav && <source src={previewWav} type="audio/wav" />}
            Your browser does not support the audio element.
          </audio>
        </div>

        {isMembersOnly && (
          <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium tracking-tight">Full Library Access</p>
              <Badge variant="secondary" className="font-normal">
                Members
              </Badge>
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">
              Love the preview? Membership unlocks the full Night Listener
              library so you can listen whenever you need a quiet place to land.
              <span className="block text-muted-foreground/80">
                Cancel anytime.
              </span>
            </p>

            <div className="space-y-2 pt-1">
              <Button
                className="min-h-12 w-full rounded-xl px-5 text-[0.95rem] leading-snug whitespace-normal sm:text-base"
                onClick={onMembershipClick}
                disabled={loading}
              >
                {loading
                  ? "Opening…"
                  : "Unlock the Full Library — $4.99/month"}
              </Button>
            </div>

            <p className="pt-1 text-xs leading-relaxed text-muted-foreground/80">
              Secure checkout powered by Stripe.
              <br />
              After joining, sign in with the same email address you used for
              membership, then open your Members library.
            </p>
          </div>
        )}

        <p className="text-xs italic text-muted-foreground">
          Tip: headphones + low volume work beautifully for late-night listening.
        </p>
      </CardContent>
    </Card>
  );
}

export default function Listen() {
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
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
    setLoadingLink(true);
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
      setLoadingLink(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMessage("");
  }

  const episodes: Episode[] = [
    {
      id: "conversation-ep2",
      title: "The Conversation That Never Finished",
      description:
        "A quiet story about misunderstanding, belief, and the words we never get the chance to finish.",
      thumbnailSrc: "/images/coffee-shop.png",
      previewMp3: "/audio/conversation-preview.mp3",
      isMembersOnly: true,
      tags: ["story", "reflection", "relationships"],
      category: "night_story",
    },
    {
      id: "replays-ep1",
      title: "Why Your Mind Replays Conversations at Night",
      description:
        "A gentle reflection on rumination and why the mind revisits social moments when the world becomes quiet.",
      thumbnailSrc: "/images/why-mind-replays-thumbnail.png",
      previewMp3: "/audio/why-mind-replays-preview.mp3",
      isMembersOnly: true,
      tags: ["bedtime", "calm", "human behavior"],
      category: "human_behavior",
    },
  ];

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Listen
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Explore late-night previews from the Night Listener library. Start with
          a free full story on the home page, then unlock the full library with
          membership.
        </p>
      </header>

      <Card className="rounded-[28px] border border-border/70">
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium">Member sign in</p>
            <p className="text-sm text-muted-foreground">
              Already a member? Sign in with the same email address you used for
              membership to open your full library.
            </p>
          </div>

          {sessionEmail ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">
                  {sessionEmail}
                </span>
              </p>

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/members">Go to Members</Link>
                </Button>

                <Button variant="outline" onClick={signOut}>
                  Sign out
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="sm:max-w-sm"
              />

              <Button onClick={sendLink} disabled={!email || loadingLink}>
                {loadingLink ? "Sending…" : "Send magic link"}
              </Button>
            </div>
          )}

          {message && (
            <p className="text-xs text-muted-foreground">{message}</p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-6 md:grid-cols-2 xl:gap-8">
        {episodes.map((ep) => (
          <EpisodeCard key={ep.id} episode={ep} />
        ))}
      </section>
    </div>
  );
}