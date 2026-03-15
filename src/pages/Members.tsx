import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type MemberEpisode = {
  id: string;
  title: string;
  description: string;
  thumbnailSrc: string;
  tags: string[];
};

const EPISODES: MemberEpisode[] = [
  {
    id: "conversation-ep2",
    title: "The Conversation That Never Finished",
    description:
      "A quiet story about misunderstanding, belief, and the words we never get the chance to finish.",
    thumbnailSrc: "/images/coffee-shop.png",
    tags: ["story", "reflection", "relationships"],
  },
  {
    id: "replays-ep1",
    title: "Why Your Mind Replays Conversations at Night",
    description:
      "A gentle reflection on rumination and why the mind revisits social moments when the world becomes quiet.",
    thumbnailSrc: "/images/why-mind-replays-thumbnail.png",
    tags: ["bedtime", "calm", "human behavior"],
  },
];

function trackEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", eventName, {
      site: "stabileusa",
      page_name: "members",
      page_location: window.location.pathname,
      ...params,
    });
  }
}

export default function Members() {
  const [episodeId, setEpisodeId] = useState("conversation-ep2");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const selectedEpisode = useMemo(
    () => EPISODES.find((ep) => ep.id === episodeId) ?? EPISODES[0],
    [episodeId]
  );

  async function fetchSignedUrl(selectedId = episodeId) {
    setLoading(true);
    setStatus("");
    setSignedUrl(null);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setStatus("Please sign in first with your magic link.");
      setLoading(false);
      return;
    }

    try {
      const r = await fetch(
        `/api/signed-audio?episodeId=${encodeURIComponent(selectedId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const j = await r.json();

      if (!r.ok) {
        setStatus(j.error || "Not entitled");
        setLoading(false);
        return;
      }

      setSignedUrl(j.url);
      setStatus("Unlocked ✅");

      const loadedEpisode =
        EPISODES.find((ep) => ep.id === selectedId) ?? selectedEpisode;

      trackEvent("member_episode_load", {
        episode_id: selectedId,
        episode_title: loadedEpisode.title,
      });
    } catch (error) {
      setStatus("Something went wrong while loading your episode.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSignedUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEpisodeChange(id: string) {
    setEpisodeId(id);
    setSignedUrl(null);
    setStatus("");

    const nextEpisode = EPISODES.find((ep) => ep.id === id);

    trackEvent("member_episode_select", {
      episode_id: id,
      episode_title: nextEpisode?.title,
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Members
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Full Night Listener episodes live here. If you subscribed or unlocked an
          episode, this page loads your secure listening link.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden rounded-[28px] border border-border/70">
          <div className="border-b px-6 py-5">
            <p className="text-sm font-medium">Your library</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Select an episode to load its secure full audio.
            </p>
          </div>

          <CardContent className="space-y-3 p-4">
            {EPISODES.map((ep) => {
              const isActive = ep.id === episodeId;

              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => handleEpisodeChange(ep.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    isActive
                      ? "border-primary/40 bg-muted/40 shadow-sm"
                      : "border-border/70 bg-background hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={ep.thumbnailSrc}
                      alt={ep.title}
                      className="h-16 w-16 rounded-xl object-cover"
                      loading="lazy"
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">
                        {ep.title}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {ep.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border border-border/70 shadow-sm">
          <div className="relative">
            <img
              src={selectedEpisode.thumbnailSrc}
              alt={selectedEpisode.title}
              className="h-64 w-full object-cover sm:h-72"
              loading="lazy"
            />
            <div className="absolute top-4 right-4">
              <Badge className="shadow-sm">Members</Badge>
            </div>
          </div>

          <CardContent className="space-y-6 p-6">
            <div className="space-y-3">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold leading-tight tracking-tight">
                  {selectedEpisode.title}
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  {selectedEpisode.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="font-normal">
                  {selectedEpisode.id}
                </Badge>

                {selectedEpisode.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="rounded-full px-3 py-1 font-normal"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Secure full episode</p>
                  <p className="text-xs text-muted-foreground">
                    Storage path should match: episodes/{selectedEpisode.id}/full.mp3
                  </p>
                </div>

                <Badge variant="secondary" className="font-normal">
                  Signed URL
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => fetchSignedUrl()}
                  disabled={loading}
                  className="rounded-xl"
                >
                  {loading ? "Loading…" : "Load / Refresh"}
                </Button>

                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setSignedUrl(null);
                    setStatus("");
                  }}
                >
                  Clear
                </Button>
              </div>

              {status && (
                <p className="mt-4 text-sm text-muted-foreground">{status}</p>
              )}

              {signedUrl && (
                <div className="mt-5 space-y-3">
                  <p className="text-sm font-medium">Now playing</p>
                  <audio controls preload="none" className="w-full" src={signedUrl} />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Your secure link expires after a short time. If playback stops,
                    click <span className="font-medium">Load / Refresh</span>.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-background p-5">
              <p className="text-sm font-medium">Helpful note</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                If you unlocked a single episode, only that episode will load. If you
                joined as a member, your full library should be available here.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
