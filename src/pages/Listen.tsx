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
  isFreeFullEpisode?: boolean;
  tags?: string[];
  category?: string;
};

function stopOtherAudio(current: HTMLAudioElement) {
  document.querySelectorAll("audio").forEach((a) => {
    if (a !== current) a.pause();
  });
}

function trackEvent(
  eventName: string,
  params: Record<string, any> = {},
) {
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
    isFreeFullEpisode = false,
    tags = [],
    category = "general",
  } = episode;

  const [loading, setLoading] = useState(false);
  const hasPublicAudio = Boolean(previewMp3 || previewWav);

  function onPreviewPlay() {
    trackEvent("preview_play", {
      episode_id: id,
      episode_title: title,
      episode_category: category,
      is_free_full_episode: isFreeFullEpisode,
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

  const badgeLabel = isFreeFullEpisode
    ? "Free full episode"
    : isMembersOnly
      ? hasPublicAudio
        ? "Preview + Members"
        : "Members only"
      : "Free";

  const playerLabel = isFreeFullEpisode
    ? "Listen free"
    : "Preview";

  const playerBadge = isFreeFullEpisode
    ? "Free"
    : "Preview";

  return (
    <Card
      className="
        group
        h-full
        overflow-hidden
        rounded-[2rem]
        border-white/10
        bg-[#07101a]
        text-white
        shadow-[0_25px_80px_rgba(0,0,0,.22)]
        transition
        duration-300
        hover:-translate-y-1
        hover:border-white/15
        hover:shadow-[0_35px_100px_rgba(0,0,0,.32)]
      "
    >
      {thumbnailSrc && (
        <div className="relative overflow-hidden">
          <img
            src={thumbnailSrc}
            alt={title}
            className="
              h-56
              w-full
              object-cover
              transition
              duration-500
              group-hover:scale-[1.02]
              sm:h-64
              lg:h-72
            "
            loading="lazy"
          />

          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#07101a] to-transparent" />

          <div className="absolute right-4 top-4">
            <Badge
              className="
                rounded-full
                border
                border-white/10
                bg-black/65
                px-3
                py-1
                text-xs
                font-normal
                text-white
                backdrop-blur
              "
            >
              {badgeLabel}
            </Badge>
          </div>
        </div>
      )}

      <CardContent className="flex h-full flex-col p-6 sm:p-7">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d7af65]">
            Night Listener
          </p>

          <h2 className="mt-3 text-xl font-medium leading-tight tracking-[-0.025em] sm:text-2xl">
            {title}
          </h2>

          <p className="mt-4 text-sm leading-7 text-slate-400">
            {description}
          </p>

          {tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="
                    rounded-full
                    border
                    border-white/10
                    bg-white/[0.025]
                    px-3
                    py-1
                    text-xs
                    text-slate-500
                  "
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {hasPublicAudio && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-white">
                {playerLabel}
              </p>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-400">
                {playerBadge}
              </span>
            </div>

            <audio
              controls
              preload="metadata"
              className="mt-4 w-full"
              onPlay={(e) => {
                stopOtherAudio(e.currentTarget);
                onPreviewPlay();
              }}
            >
              {previewMp3 && (
                <source
                  src={previewMp3}
                  type="audio/mpeg"
                />
              )}

              {previewWav && (
                <source
                  src={previewWav}
                  type="audio/wav"
                />
              )}

              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        {isMembersOnly && !isFreeFullEpisode && (
          <div className="mt-5 rounded-2xl border border-[#d7af65]/20 bg-[#d7af65]/[0.045] p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-white">
                Full Library Access
              </p>

              <span className="rounded-full border border-[#d7af65]/20 px-3 py-1 text-[11px] text-[#d7af65]">
                Members
              </span>
            </div>

            <p className="mt-3 text-sm leading-7 text-slate-400">
              {hasPublicAudio
                ? "Continue from this preview with membership. "
                : "This complete story is available to members. "}
              Membership unlocks the complete Night Listener library so you can
              return whenever you want something thoughtful,
              calm, and deeply human.
            </p>

            <p className="mt-1 text-xs text-slate-600">
              Cancel anytime.
            </p>

            <Button
              className="
                mt-5
                min-h-11
                w-full
                rounded-full
                bg-[#d7af65]
                px-5
                text-sm
                text-black
                hover:bg-[#e7ca90]
                sm:text-base
              "
              onClick={onMembershipClick}
              disabled={loading}
            >
              {loading
                ? "Opening…"
                : "Unlock the Full Library — $4.99/month"}
            </Button>

            <p className="mt-3 text-center text-xs leading-5 text-slate-600">
              Secure checkout powered by Stripe.
            </p>
          </div>
        )}

        <p className="mt-auto pt-5 text-xs italic text-slate-600">
          Tip: headphones + low volume work beautifully for
          quiet listening.
        </p>
      </CardContent>
    </Card>
  );
}

export default function Listen() {
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] =
    useState<string | null>(null);
  const [loadingLink, setLoadingLink] =
    useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });

    const { data: sub } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setSessionEmail(
            session?.user.email ?? null,
          );
        },
      );

    return () =>
      sub.subscription.unsubscribe();
  }, []);

  async function sendLink() {
    setLoadingLink(true);
    setMessage("");

    try {
      const { error } =
        await sendMagicLink(email);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "Magic link sent. Check your email and use the same address you used for membership.",
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
      id: "say-sorry-ep3",
      title:
        "You Were Right… But You Never Said Sorry",
      description:
        "A quiet story about being right, holding back an apology, and the kind of moment people replay long after it happens.",
      thumbnailSrc:
        "/images/say-sorry.png",
      previewMp3:
        "/audio/say-sorry-ep3.mp3",
      isFreeFullEpisode: true,
      tags: [
        "story",
        "reflection",
        "relationships",
      ],
      category: "free_story",
    },
    {
      id: "im-fine-ep6",
      title:
        "Why We Say “I’m Fine” When It’s Not",
      description:
        "A quiet story about the moment something shifts—and why we often say “I’m fine” instead of what we actually feel.",
      thumbnailSrc:
        "/images/im-fine.png",
      isMembersOnly: true,
      tags: [
        "story",
        "relationships",
        "human behavior",
      ],
      category: "members_story",
    },
    {
      id: "conversation-ep2",
      title:
        "The Conversation That Never Finished",
      description:
        "A quiet story about misunderstanding, belief, and the words we never get the chance to finish.",
      thumbnailSrc:
        "/images/coffee-shop.png",
      isMembersOnly: true,
      tags: [
        "story",
        "reflection",
        "relationships",
      ],
      category: "night_story",
    },
    {
      id: "replays-ep1",
      title:
        "Why Your Mind Replays Conversations at Night",
      description:
        "A gentle reflection on rumination and why the mind revisits social moments when the world becomes quiet.",
      thumbnailSrc:
        "/images/why-mind-replays-thumbnail.png",
      previewMp3:
        "/audio/why-mind-replays-preview.mp3",
      isMembersOnly: true,
      tags: [
        "calm",
        "reflection",
        "human behavior",
      ],
      category: "human_behavior",
    },
  ];

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
            INTRO
        ====================================================== */}

        <header className="mx-auto max-w-5xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d7af65]">
            Night Listener
          </p>

          <h1 className="mt-5 text-3xl font-medium tracking-[-0.035em] sm:text-4xl lg:text-5xl">
            Listen
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-400 sm:text-lg">
            Start with one free full story, explore
            previews, and discover Night Listener
            through relationships, human behavior,
            memory, and the moments that stay with us.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/[0.025] px-4 py-2 text-xs text-slate-500">
              One free full story
            </span>

            <span className="rounded-full border border-white/10 bg-white/[0.025] px-4 py-2 text-xs text-slate-500">
              Members-only stories
            </span>

            <span className="rounded-full border border-white/10 bg-white/[0.025] px-4 py-2 text-xs text-slate-500">
              Quiet listening
            </span>
          </div>
        </header>

        {/* ======================================================
            MEMBER SIGN IN
        ====================================================== */}

        <Card className="mx-auto mt-12 max-w-5xl rounded-[2rem] border-white/10 bg-[#07101a] text-white shadow-[0_25px_80px_rgba(0,0,0,.22)]">
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d7af65]">
                  Member Access
                </p>

                <h2 className="mt-3 text-xl font-medium tracking-[-0.025em] sm:text-2xl">
                  Already a member?
                </h2>

                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Sign in with the same email address
                  you used for membership to open your
                  full Night Listener library.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                {sessionEmail ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-400">
                      Signed in as{" "}
                      <span className="font-medium text-white">
                        {sessionEmail}
                      </span>
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        asChild
                        className="rounded-full bg-[#d7af65] text-black hover:bg-[#e7ca90]"
                      >
                        <Link to="/members">
                          Open Members
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) =>
                          setEmail(e.target.value)
                        }
                        className="h-11 flex-1 border-white/10 bg-[#03070d] text-white placeholder:text-slate-700"
                      />

                      <Button
                        onClick={sendLink}
                        disabled={
                          !email || loadingLink
                        }
                        className="h-11 shrink-0 rounded-full bg-[#d7af65] px-6 text-black hover:bg-[#e7ca90]"
                      >
                        {loadingLink
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
            </div>
          </CardContent>
        </Card>

        {/* ======================================================
            EPISODES
        ====================================================== */}

        <section className="mt-14">
          <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d7af65]">
                Stories & Reflections
              </p>

              <h2 className="mt-3 text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
                Explore the library
              </h2>
            </div>

            <Link
              to="/join"
              className="text-sm text-[#d7af65] underline underline-offset-4 transition hover:text-[#efd296]"
            >
              View membership
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:gap-8">
            {episodes.map((episode) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
              />
            ))}
          </div>
        </section>

        {/* ======================================================
            BOTTOM CTA
        ====================================================== */}

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-[#050a11] px-6 py-9 text-center sm:px-10 sm:py-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d7af65]">
            Keep Listening
          </p>

          <h2 className="mx-auto mt-4 max-w-2xl text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
            More stories are inside the full Night
            Listener library.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Membership gives you access to the
            complete collection and a simple
            password-free way to return whenever
            you want to listen.
          </p>

          <Button
            asChild
            className="mt-6 rounded-full bg-[#d7af65] px-7 text-black hover:bg-[#e7ca90]"
          >
            <Link to="/join">
              Explore Membership
            </Link>
          </Button>
        </section>
      </div>
    </section>
  );
}
