
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Episode = {
  id: string;
  title: string;
  description: string;
  thumbnailSrc?: string;
  previewMp3?: string;
  previewWav?: string;
  isLocked?: boolean;
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

async function requireAccessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in first.");
  return token;
}

async function startCheckout(body: Record<string, unknown>) {
  const token = await requireAccessToken();

  const r = await fetch("/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const j = await r.json();

  if (!r.ok) throw new Error(j.error || "Checkout failed");
  if (!j.url) throw new Error("Missing session url");

  window.location.href = j.url;
}

function EpisodeCard({ episode }: { episode: Episode }) {
  const {
    id,
    title,
    description,
    thumbnailSrc,
    previewMp3,
    previewWav,
    isLocked = false,
    tags = [],
    category = "general",
  } = episode;

  const [loading, setLoading] = useState<null | "sub" | "one">(null);

  async function onSubscribe() {
    try {
      setLoading("sub");

      trackEvent("membership_signup_click", {
        episode_id: id,
        episode_title: title,
        episode_category: category,
        value: 4.99,
        currency: "USD",
      });

      await startCheckout({ mode: "subscription" });
    } catch (e: any) {
      alert(e?.message || "Please sign in first.");
    } finally {
      setLoading(null);
    }
  }

  async function onOneTime() {
    try {
      setLoading("one");

      trackEvent("episode_unlock_click", {
        episode_id: id,
        episode_title: title,
        episode_category: category,
        value: 2.99,
        currency: "USD",
      });

      await startCheckout({ mode: "one_time", episodeId: id });
    } catch (e: any) {
      alert(e?.message || "Please sign in first.");
    } finally {
      setLoading(null);
    }
  }

  function onPreviewPlay() {
    trackEvent("preview_play", {
      episode_id: id,
      episode_title: title,
      episode_category: category,
    });
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
          <div className="absolute top-3 right-3">
            <Badge className="shadow-sm">{isLocked ? "Preview" : "Free"}</Badge>
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
            <p className="text-sm font-medium">Free Preview</p>
            <Badge variant="secondary" className="font-normal">
              Preview
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

        {isLocked && (
          <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium tracking-tight">Full Episode</p>
              <Badge variant="secondary" className="font-normal">
                Locked
              </Badge>
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">
              Unlock the full episode with membership, or listen once.
              <span className="block text-muted-foreground/80">
                Cancel anytime.
              </span>
            </p>

            <div className="space-y-2 pt-1">
              <Button
                className="min-h-12 w-full rounded-xl px-5 text-[0.95rem] leading-snug whitespace-normal sm:text-base"
                onClick={onSubscribe}
                disabled={!!loading}
              >
                {loading === "sub"
                  ? "Redirecting…"
                  : "Unlock All Episodes — $4.99/month"}
              </Button>

              <Button
                variant="outline"
                className="min-h-12 w-full rounded-xl px-5 text-[0.95rem] sm:text-base"
                onClick={onOneTime}
                disabled={!!loading}
              >
                {loading === "one"
                  ? "Redirecting…"
                  : "Listen Once — $2.99"}
              </Button>
            </div>

            <p className="pt-1 text-xs leading-relaxed text-muted-foreground/80">
              Secure checkout powered by Stripe.
              <br />
              After purchase, return here and go to Members to listen.
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
  const episodes: Episode[] = [
    {
      id: "conversation-ep2",
      title: "The Conversation That Never Finished",
      description:
        "A quiet story about misunderstanding, belief, and the words we never get the chance to finish.",
      thumbnailSrc: "/images/coffee-shop.png",
      previewMp3: "/audio/conversation-preview.mp3",
      isLocked: true,
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
      isLocked: true,
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
          Cozy late-night stories about human behavior, reflection, and the quiet
          moments that shape our lives.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:gap-8">
        {episodes.map((ep) => (
          <EpisodeCard key={ep.id} episode={ep} />
        ))}
      </section>
    </div>
  );
}
