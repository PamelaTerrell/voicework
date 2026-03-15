import { Link } from "react-router-dom";
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
  status?: "available" | "coming_soon";
};

// Prevent multiple audios playing at once
function stopOtherAudio(current: HTMLAudioElement) {
  document.querySelectorAll("audio").forEach((a) => {
    if (a !== current) a.pause();
  });
}

// GA helper
function trackEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, {
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
    status = "available",
  } = episode;

  const [loading, setLoading] = useState<null | "sub" | "one">(null);
  const hasPreview = Boolean(previewMp3 || previewWav);

  async function onSubscribe() {
    try {
      setLoading("sub");

      trackEvent("membership_signup_click", {
        episode_id: id,
        episode_title: title,
        episode_category: category,
        plan: "monthly_membership",
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
    <Card className="group overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      {thumbnailSrc && (
        <div className="relative overflow-hidden">
          <img
            src={thumbnailSrc}
            alt={`${title} thumbnail`}
            className="h-72 w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            loading="lazy"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />

          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <Badge className="bg-background/85 text-foreground backdrop-blur">
              {status === "coming_soon" ? "Coming Soon" : isLocked ? "Preview" : "Free"}
            </Badge>

            {category === "night_listener_story" && (
              <Badge variant="secondary" className="bg-background/75 backdrop-blur">
                Night Listener
              </Badge>
            )}
          </div>
        </div>
      )}

      <CardContent className="space-y-6 p-6">
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold leading-tight">{title}</h2>
            <p className="text-sm leading-7 text-muted-foreground">{description}</p>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {tags.map((t: string) => (
                <Badge key={t} variant="outline" className="rounded-full px-3 py-1 font-normal">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {hasPreview ? (
          <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Free Preview</p>
              <Badge variant="secondary" className="font-normal">
                Available
              </Badge>
            </div>

            <audio
              controls
              preload="none"
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
        ) : (
          <div className="rounded-2xl border bg-muted/30 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Preview coming soon</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pamela is currently recording this episode for Night Listener.
                </p>
              </div>
              <Badge variant="secondary" className="whitespace-nowrap font-normal">
                In Production
              </Badge>
            </div>
          </div>
        )}

        {isLocked && (
          <div className="space-y-5 rounded-2xl border bg-background p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Full Episode</p>
              <Badge className="font-normal">Locked</Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              Unlock the full bedtime-length episode with membership, or listen once.
              <span className="mt-1 block">Cancel anytime.</span>
            </p>

           <div className="space-y-2">
  <Button
    className="min-h-12 w-full rounded-xl px-5 text-[0.95rem] sm:text-base whitespace-normal leading-snug"
    onClick={onSubscribe}
    disabled={!!loading}
  >
    {loading === "sub" ? "Redirecting…" : "Unlock All Episodes — $4.99/month"}
  </Button>

  <Button
    variant="outline"
    className="min-h-12 w-full rounded-xl px-5 text-[0.95rem] sm:text-base"
    onClick={onOneTime}
    disabled={!!loading}
  >
    {loading === "one" ? "Redirecting…" : "Listen Once — $2.99"}
  </Button>
</div>


            <p className="text-xs leading-5 text-muted-foreground">
              Secure checkout powered by Stripe. After purchase, return here and go to Members to listen.
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
      id: "replays-ep1",
      title: "Why Your Mind Replays Conversations at Night",
      description:
        "A gentle bedtime reflection on rumination, emotional processing, and why your brain revisits social moments when the world gets quiet.",
      thumbnailSrc: "/images/why-mind-replays-thumbnail.png",
      previewMp3: "/audio/why-mind-replays-preview.mp3",
      isLocked: true,
      tags: ["bedtime", "calm", "human behavior", "mind"],
      category: "human_behavior",
      status: "available",
    },
    {
      id: "conversation-ep1",
      title: "The Conversation That Never Finished",
      description:
        "A quiet late-night story about deep friendship, misunderstanding, and the haunting realization that what once felt like betrayal may have been something entirely different.",
      thumbnailSrc: "/images/coffee-shop.png",
      isLocked: true,
      tags: ["night listener", "storytelling", "friendship", "reflection"],
      category: "night_listener_story",
      status: "coming_soon",
    },
  ];

  const comingNext: string[] = [
    "The Letter That Was Never Sent",
    "Why Humans Crave Belonging",
    "The Hidden Rules of Social Norms",
  ];

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Listen</h1>
          <p className="max-w-2xl text-muted-foreground">
            Cozy late-night listening about human behavior, quiet reflection, and stories
            that stay with you long after the world goes still.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button asChild className="rounded-xl">
            <Link
              to="/join"
              onClick={() =>
                trackEvent("listen_nav_click", {
                  destination: "/join",
                  cta_label: "Join",
                })
              }
            >
              Join
            </Link>
          </Button>

          <Button asChild variant="secondary" className="rounded-xl">
            <Link
              to="/contact"
              onClick={() =>
                trackEvent("listen_nav_click", {
                  destination: "/contact",
                  cta_label: "Collaborations / Contact",
                })
              }
            >
              Collaborations / Contact
            </Link>
          </Button>

          <Button asChild variant="outline" className="rounded-xl">
            <Link
              to="/members"
              onClick={() =>
                trackEvent("listen_nav_click", {
                  destination: "/members",
                  cta_label: "Members",
                })
              }
            >
              Members
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {episodes.map((ep) => (
          <EpisodeCard key={ep.id} episode={ep} />
        ))}
      </section>

      <section className="rounded-[28px] border bg-background p-6 sm:p-10">
        <div className="space-y-5">
          <div className="space-y-1">
            <p className="text-lg font-medium">Coming next</p>
            <p className="text-sm text-muted-foreground">
              New Night Listener episodes are in production and will appear here soon.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {comingNext.map((t: string) => (
              <div
                key={t}
                className="rounded-2xl border bg-muted/20 p-4 transition-colors hover:bg-muted/30"
              >
                <p className="text-sm font-medium">{t}</p>
                <p className="mt-1 text-xs text-muted-foreground">In progress</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Want early access when new episodes drop?
            </p>

            <div className="flex gap-2">
              <Button asChild className="rounded-xl">
                <Link
                  to="/join"
                  onClick={() =>
                    trackEvent("coming_next_join_click", {
                      location: "coming_next",
                      cta_label: "Join",
                    })
                  }
                >
                  Join
                </Link>
              </Button>

              <Button asChild variant="outline" className="rounded-xl">
                <Link
                  to="/"
                  onClick={() =>
                    trackEvent("listen_nav_click", {
                      destination: "/",
                      cta_label: "Back to Home",
                    })
                  }
                >
                  Back to Home
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
