import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sendMagicLink } from "@/lib/sendMagicLink";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MemberEpisode = {
  id: string;
  title: string;
  description: string;
  thumbnailSrc: string;
  tags: string[];
};

type MemberAccessResponse = {
  ok?: boolean;
  isSubscriber?: boolean;
  cancellationScheduled?: boolean;
  cancellationEffectiveAt?: number | null;

  profile?: {
    id: string;
    email: string | null;
    is_subscriber: boolean | null;
    subscription_status: string | null;
    stripe_customer_id?: string | null;
  } | null;

  subscription?: {
    id: string;
    status: string;
    cancel_at_period_end: boolean;
    cancel_at: number | null;
    current_period_end: number | null;
  } | null;

  error?: string;
};

const FREE_EPISODE_IDS = new Set([
  "say-sorry-ep3",
  "im-fine-ep6",
]);

const DEFAULT_EPISODE_ID = "say-sorry-ep3";

const EPISODES: MemberEpisode[] = [
  {
    id: "love-him-anyway-15",
    title: "When a Man Realizes You Love Him Anyway",
    description:
      "A quiet story about the moment a man realizes he does not have to be strong, successful, or useful every second to still be loved.",
    thumbnailSrc: "/images/love-him-anyway-15.png",
    tags: ["story", "relationships", "love"],
  },
  {
    id: "toast-ep14",
    title: "A Toast to the End of Us",
    description:
      "A quiet story about familiarity, contempt, eye rolls, and the small everyday criticisms that can slowly end a marriage.",
    thumbnailSrc: "/images/toast-ep14.png",
    tags: ["story", "relationships", "contempt"],
  },
  {
    id: "life-you-didnt-get-ep13",
    title: "The Life You Almost Didn’t Get",
    description:
      "A quiet reflection on love, choice, the road not taken, and the ache of wondering who you might have become if life had stayed on its original course.",
    thumbnailSrc: "/images/the-life-you-almost-didnt-get.png",
    tags: ["reflection", "love", "what might have been"],
  },
  {
    id: "the-hardest-people-ep12",
    title: "The Hardest People to Heal From",
    description:
      "The hardest people to heal from are often the ones who truly loved you badly — the ones who were both comfort and chaos.",
    thumbnailSrc: "/images/the-hardest-people-ep12.png",
    tags: ["story", "relationships", "healing"],
  },
  {
    id: "never-made-you-guess-ep11",
    title: "The One Who Never Made You Guess",
    description:
      "A quiet reflection on the kind of love that does not confuse you, chase you, or make you question your worth — the steady love many people only recognize after pain.",
    thumbnailSrc: "/images/never-made-you-guessep11.png",
    tags: ["story", "relationships", "peace"],
  },
  {
    id: "had-everything-part2-ep10",
    title: "She Had Everything… (Part 2)",
    description:
      "The house is quiet now. What once felt ordinary becomes priceless when it’s gone—and some lessons only arrive in silence.",
    thumbnailSrc: "/images/she-had-everything-part2.png",
    tags: ["story", "relationships", "regret"],
  },
  {
    id: "had-everything-part1-ep9",
    title: "She Had Everything… (Part 1)",
    description:
      "She had the kind of life people never question — until something small, private, and quietly repeated begins to change everything.",
    thumbnailSrc: "/images/she-had-everything-part1.png",
    tags: ["story", "human behavior", "mystery"],
  },
  {
    id: "lonely-night-part2-ep8",
    title: "The Night He Stayed Inside",
    description:
      "Part 2: His Version — While she sat outside believing the silence meant he didn’t care, he was inside facing something he didn’t yet know how to hold.",
    thumbnailSrc: "/images/lonely-night-part2.png",
    tags: ["story", "relationships", "perspective"],
  },
  {
    id: "lonely-night-ep7",
    title: "The Night It Ended (Or So She Thought)",
    description:
      "Part 1: Her Version — She sat outside his apartment, staring at a message that felt final. But the truth of that night… wasn’t as complete as she believed.",
    thumbnailSrc: "/images/lonely-night.png",
    tags: ["story", "relationships", "perspective"],
  },
  {
    id: "im-fine-ep6",
    title: "Why We Say “I’m Fine” When It’s Not",
    description:
      "A quiet story about the small moments we dismiss, the things we don’t say, and how something subtle can quietly shift a connection.",
    thumbnailSrc: "/images/im-fine.png",
    tags: ["story", "relationships", "human behavior"],
  },
  {
    id: "versions-ep5",
    title: "The Versions We Never Meant to See",
    description:
      "A quiet story about how two people can care deeply for each other—yet slowly begin responding to versions of each other that were never really there.",
    thumbnailSrc: "/images/never-meant-to-see.png",
    tags: ["story", "reflection", "relationships"],
  },
  {
    id: "resentment-ep4",
    title: "The Quiet Weight of Resentment",
    description:
      "A quiet story about what builds when nothing is said—and how distance can grow without either person realizing it.",
    thumbnailSrc: "/images/resentment.png",
    tags: ["story", "reflection", "relationships"],
  },
  {
    id: "say-sorry-ep3",
    title: "You Were Right… But You Never Said Sorry",
    description:
      "A quiet reflection on being right, the moment you almost apologized, and what it cost you not to.",
    thumbnailSrc: "/images/say-sorry.png",
    tags: ["story", "reflection", "relationships"],
  },
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
    tags: ["story", "calm", "human behavior"],
  },
];

function isFreeEpisode(id: string) {
  return FREE_EPISODE_IDS.has(id);
}

function stopOtherAudio(current: HTMLAudioElement) {
  document.querySelectorAll("audio").forEach((audio) => {
    if (audio !== current) {
      audio.pause();
    }
  });
}

function trackEvent(
  eventName: string,
  params: Record<string, unknown> = {},
) {
  if (
    typeof window !== "undefined" &&
    typeof (window as any).gtag === "function"
  ) {
    (window as any).gtag("event", eventName, {
      site: "stabileusa",
      page_name: "members",
      content_type: "episode",
      page_location: window.location.pathname,
      ...params,
    });
  }
}

function isActiveStatus(status?: string | null) {
  return status === "active" || status === "trialing";
}

function formatDate(timestamp?: number | null) {
  if (!timestamp) return null;

  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getDaysRemaining(timestamp?: number | null) {
  if (!timestamp) return null;

  const diff = timestamp * 1000 - Date.now();

  if (diff <= 0) return 0;

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function Members() {
  const [episodeId, setEpisodeId] =
    useState(DEFAULT_EPISODE_ID);

  const [signedUrl, setSignedUrl] =
    useState<string | null>(null);

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [sessionEmail, setSessionEmail] =
    useState<string | null>(null);

  const [sessionUserId, setSessionUserId] =
    useState<string | null>(null);

  const [checkingAccess, setCheckingAccess] =
    useState(false);

  const [isSubscriber, setIsSubscriber] =
    useState(false);

  const [
    cancellationScheduled,
    setCancellationScheduled,
  ] = useState(false);

  const [
    cancellationEffectiveAt,
    setCancellationEffectiveAt,
  ] = useState<number | null>(null);

  const [stripeCustomerId, setStripeCustomerId] =
    useState<string | null>(null);

  const [cancelLoading, setCancelLoading] =
    useState(false);

  const [cancelMessage, setCancelMessage] =
    useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] =
    useState(false);
  const [loginMessage, setLoginMessage] =
    useState("");

  const selectedEpisode = useMemo(
    () =>
      EPISODES.find(
        (episode) => episode.id === episodeId,
      ) ?? EPISODES[0],
    [episodeId],
  );

  const selectedIsFree = isFreeEpisode(episodeId);

  const isSignedIn = Boolean(sessionEmail);
  const hasAccess = Boolean(signedUrl);

  const formattedEndDate =
    formatDate(cancellationEffectiveAt);

  const daysRemaining =
    getDaysRemaining(cancellationEffectiveAt);

  const showCancelButton =
    isSignedIn &&
    isSubscriber &&
    !cancellationScheduled;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(
        data.session?.user.email ?? null,
      );

      setSessionUserId(
        data.session?.user.id ?? null,
      );
    });

    const { data: sub } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setSessionEmail(
            session?.user.email ?? null,
          );

          setSessionUserId(
            session?.user.id ?? null,
          );
        },
      );

    return () =>
      sub.subscription.unsubscribe();
  }, []);

  async function handleSendMagicLink() {
    const email = loginEmail.trim();

    if (!email) return;

    setLoginLoading(true);
    setLoginMessage("");

    try {
      const { error } =
        await sendMagicLink(email);

      if (error) {
        setLoginMessage(error.message);
        return;
      }

      setLoginMessage(
        "Magic link sent. Check your email and use the same address you used for membership.",
      );

      setLoginEmail("");
    } catch (error) {
      setLoginMessage(
        error instanceof Error
          ? error.message
          : "Unable to send your sign-in link.",
      );
    } finally {
      setLoginLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();

    setLoginMessage("");
    setCancelMessage("");
    setStatus("");
    setSignedUrl(null);
    setIsSubscriber(false);
    setCancellationScheduled(false);
    setCancellationEffectiveAt(null);
    setStripeCustomerId(null);
  }

  async function checkMemberAccess(email: string) {
    setCheckingAccess(true);
    setCancelMessage("");

    try {
      const { data } =
        await supabase.auth.getSession();

      const userId =
        data.session?.user.id ??
        sessionUserId ??
        "";

      const response = await fetch(
        `/api/member-access?email=${encodeURIComponent(
          email,
        )}&userId=${encodeURIComponent(userId)}`,
      );

      const result: MemberAccessResponse =
        await response.json();

      if (!response.ok) {
        setIsSubscriber(false);
        setCancellationScheduled(false);
        setCancellationEffectiveAt(null);
        setStripeCustomerId(null);

        setStatus(
          result.error ||
            "Unable to verify membership.",
        );

        return false;
      }

      const active =
        Boolean(result.isSubscriber) ||
        isActiveStatus(
          result.profile?.subscription_status,
        ) ||
        isActiveStatus(
          result.subscription?.status,
        );

      setIsSubscriber(active);

      setCancellationScheduled(
        Boolean(result.cancellationScheduled),
      );

      setCancellationEffectiveAt(
        result.cancellationEffectiveAt ?? null,
      );

      setStripeCustomerId(
        result.profile?.stripe_customer_id ??
          null,
      );

      return active;
    } catch (error) {
      setIsSubscriber(false);
      setCancellationScheduled(false);
      setCancellationEffectiveAt(null);
      setStripeCustomerId(null);

      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to verify membership.",
      );

      return false;
    } finally {
      setCheckingAccess(false);
    }
  }

  async function fetchSignedUrl(
    selectedId = episodeId,
  ) {
    setLoading(true);
    setStatus("");
    setSignedUrl(null);

    const { data } =
      await supabase.auth.getSession();

    const token =
      data.session?.access_token;

    const email =
      data.session?.user.email ?? null;

    const episodeIsFree =
      isFreeEpisode(selectedId);

    if (!token || !email) {
      setIsSubscriber(false);
      setCancellationScheduled(false);
      setCancellationEffectiveAt(null);
      setStripeCustomerId(null);

      setStatus(
        episodeIsFree
          ? "Sign in below to open this free story in your library."
          : "This story is waiting inside the full Night Listener library.",
      );

      setLoading(false);
      return;
    }

    const hasMembership =
      await checkMemberAccess(email);

    try {
      const response = await fetch(
        `/api/signed-audio?episodeId=${encodeURIComponent(
          selectedId,
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        if (
          !hasMembership &&
          episodeIsFree &&
          response.status === 403
        ) {
          setStatus(
            "This free story could not be opened. Please try again.",
          );
        } else if (
          !hasMembership &&
          response.status === 403
        ) {
          setStatus(
            "This story is part of the full Night Listener library.",
          );
        } else {
          setStatus(
            result.error ||
              "Unable to open this story.",
          );
        }

        return;
      }

      setSignedUrl(result.url);

      setStatus(
        hasMembership
          ? "Your library is open."
          : episodeIsFree
            ? "This free story is ready."
            : "Your story is ready.",
      );

      const loadedEpisode =
        EPISODES.find(
          (episode) =>
            episode.id === selectedId,
        ) ?? selectedEpisode;

      trackEvent("member_episode_load", {
        episode_id: selectedId,
        episode_title:
          loadedEpisode.title,
        is_subscriber: hasMembership,
        is_free_episode: episodeIsFree,
      });
    } catch (error) {
      setSignedUrl(null);

      setStatus(
        error instanceof Error
          ? error.message
          : "Something went wrong while opening your story.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelMembership() {
    setCancelLoading(true);
    setCancelMessage("");
    setStatus("");

    try {
      const { data } =
        await supabase.auth.getSession();

      const token =
        data.session?.access_token;

      if (!token) {
        setCancelMessage(
          "Please sign in first.",
        );
        return;
      }

      const response = await fetch(
        "/api/cancel-membership",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        setCancelMessage(
          result.error ||
            "Unable to cancel membership.",
        );
        return;
      }

      setCancelMessage(
        result.message ||
          "Your membership has been canceled. Access will continue through the end of your current billing period.",
      );

      trackEvent(
        "member_cancel_membership",
      );

      if (sessionEmail) {
        await checkMemberAccess(
          sessionEmail,
        );
      }

      setSignedUrl(null);
    } catch (error) {
      setCancelMessage(
        error instanceof Error
          ? error.message
          : "Unable to cancel membership.",
      );
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleResumeMembership() {
    if (!stripeCustomerId) {
      setCancelMessage(
        "Unable to resume membership right now. Please refresh and try again.",
      );
      return;
    }

    setCancelLoading(true);
    setCancelMessage("");

    try {
      const { data } =
        await supabase.auth.getSession();

      const token =
        data.session?.access_token;

      if (!token) {
        setCancelMessage(
          "Please sign in first.",
        );
        return;
      }

      const response = await fetch(
        "/api/resume-membership",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            customerId: stripeCustomerId,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        setCancelMessage(
          result.error ||
            "Unable to resume membership.",
        );
        return;
      }

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      if (sessionEmail) {
        await checkMemberAccess(
          sessionEmail,
        );
      }

      setCancelMessage(
        "Your membership has been resumed.",
      );
    } catch (error) {
      setCancelMessage(
        error instanceof Error
          ? error.message
          : "Unable to resume membership.",
      );
    } finally {
      setCancelLoading(false);
    }
  }

  useEffect(() => {
    if (sessionEmail) {
      fetchSignedUrl(episodeId);
      return;
    }

    setSignedUrl(null);
    setIsSubscriber(false);
    setCancellationScheduled(false);
    setCancellationEffectiveAt(null);
    setStripeCustomerId(null);
    setCancelMessage("");

    setStatus(
      isFreeEpisode(episodeId)
        ? "Sign in to open this free story in your library."
        : "",
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEmail]);

  useEffect(() => {
    if (sessionEmail) {
      fetchSignedUrl(episodeId);
      return;
    }

    setSignedUrl(null);

    setStatus(
      isFreeEpisode(episodeId)
        ? "Sign in below to open this free story in your library."
        : "This story is part of the full Night Listener library. Sign in or subscribe to continue.",
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  function handleEpisodeChange(id: string) {
    setEpisodeId(id);

    const nextEpisode =
      EPISODES.find(
        (episode) => episode.id === id,
      );

    trackEvent(
      "member_episode_select",
      {
        episode_id: id,
        episode_title:
          nextEpisode?.title,
        is_free_episode:
          isFreeEpisode(id),
      },
    );
  }

  return (
    <section className="min-h-screen w-full bg-[#02060b] text-white">
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
        {/* =========================================
            INTRO
        ========================================= */}

        <header className="mx-auto max-w-5xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d7af65]">
            Night Listener
          </p>

          <h1 className="mt-5 text-3xl font-medium tracking-[-0.035em] sm:text-4xl lg:text-5xl">
            Your Library
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-400 sm:text-lg">
            A quiet place for the complete Night Listener
            collection — stories about relationships,
            memory, perspective, love, and the moments
            that stay with us.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/[0.025] px-4 py-2 text-xs text-slate-500">
              {EPISODES.length} stories
            </span>

            <span className="rounded-full border border-white/10 bg-white/[0.025] px-4 py-2 text-xs text-slate-500">
              Secure listening
            </span>

            <span className="rounded-full border border-white/10 bg-white/[0.025] px-4 py-2 text-xs text-slate-500">
              New stories added
            </span>
          </div>
        </header>

        {/* =========================================
            MEMBER ACCESS
        ========================================= */}

        <Card className="mx-auto mt-12 max-w-5xl rounded-[2rem] border-white/10 bg-[#07101a] text-white shadow-[0_25px_80px_rgba(0,0,0,.22)]">
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d7af65]">
                  Member Access
                </p>

                <h2 className="mt-3 text-xl font-medium tracking-[-0.025em] sm:text-2xl">
                  {isSignedIn
                    ? "Welcome back."
                    : "Open your library"}
                </h2>

                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {checkingAccess
                    ? "Checking your library access…"
                    : isSubscriber &&
                        cancellationScheduled
                      ? `Your membership remains active until ${
                          formattedEndDate ??
                          "the end of your billing period"
                        }${
                          daysRemaining !== null
                            ? ` — ${daysRemaining} day${
                                daysRemaining === 1
                                  ? ""
                                  : "s"
                              } remaining`
                            : ""
                        }.`
                      : isSubscriber
                        ? "Your full Night Listener collection is open."
                        : isSignedIn
                          ? "You’re signed in. Free stories are available now, and membership opens the complete collection."
                          : "Sign in with the same email address you used for membership."}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                {isSignedIn ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400">
                      Signed in as{" "}
                      <span className="font-medium text-white">
                        {sessionEmail}
                      </span>
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {!isSubscriber && (
                        <Button
                          asChild
                          className="rounded-full bg-[#d7af65] text-black hover:bg-[#e7ca90]"
                        >
                          <Link to="/join">
                            Unlock Full Library
                          </Link>
                        </Button>
                      )}

                      {isSubscriber &&
                        cancellationScheduled && (
                          <Button
                            onClick={
                              handleResumeMembership
                            }
                            disabled={
                              cancelLoading
                            }
                            className="rounded-full bg-[#d7af65] text-black hover:bg-[#e7ca90]"
                          >
                            {cancelLoading
                              ? "Working…"
                              : "Resume membership"}
                          </Button>
                        )}

                      <Button
                        variant="outline"
                        onClick={signOut}
                        className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      >
                        Sign out
                      </Button>

                      {showCancelButton && (
                        <Button
                          variant="ghost"
                          onClick={
                            handleCancelMembership
                          }
                          disabled={
                            cancelLoading
                          }
                          className="rounded-full text-slate-500 hover:bg-white/5 hover:text-slate-300"
                        >
                          {cancelLoading
                            ? "Canceling…"
                            : "Cancel membership"}
                        </Button>
                      )}
                    </div>

                    {cancelMessage && (
                      <p className="text-xs leading-6 text-slate-500">
                        {cancelMessage}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={loginEmail}
                        onChange={(e) =>
                          setLoginEmail(
                            e.target.value,
                          )
                        }
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter"
                          ) {
                            handleSendMagicLink();
                          }
                        }}
                        className="h-11 flex-1 border-white/10 bg-[#03070d] text-white placeholder:text-slate-700"
                      />

                      <Button
                        onClick={
                          handleSendMagicLink
                        }
                        disabled={
                          !loginEmail.trim() ||
                          loginLoading
                        }
                        className="h-11 shrink-0 rounded-full bg-[#d7af65] px-6 text-black hover:bg-[#e7ca90]"
                      >
                        {loginLoading
                          ? "Sending…"
                          : "Send magic link"}
                      </Button>
                    </div>

                    {loginMessage && (
                      <p className="mt-3 text-xs leading-6 text-slate-500">
                        {loginMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* =========================================
            LIBRARY
        ========================================= */}

        <section className="mt-14">
          <div className="mb-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d7af65]">
              Full Collection
            </p>

            <h2 className="mt-3 text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
              Choose a story
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Select an episode from the shelf and
              settle in.
            </p>
          </div>

          <div className="grid gap-7 xl:grid-cols-[360px_minmax(0,1fr)]">
            {/* =====================================
                EPISODE SHELF
            ===================================== */}

            <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-[#07101a] text-white shadow-[0_25px_80px_rgba(0,0,0,.22)]">
              <div className="border-b border-white/10 px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      Library Shelf
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {EPISODES.length} Night
                      Listener stories
                    </p>
                  </div>

                  <Badge className="rounded-full border border-[#d7af65]/20 bg-[#d7af65]/[0.05] text-[#d7af65]">
                    Members
                  </Badge>
                </div>
              </div>

              <CardContent className="max-h-[820px] space-y-2 overflow-y-auto p-3">
                {EPISODES.map(
                  (episode, index) => {
                    const active =
                      episode.id ===
                      episodeId;

                    const episodeIsFree =
                      isFreeEpisode(
                        episode.id,
                      );

                    return (
                      <button
                        key={episode.id}
                        type="button"
                        onClick={() =>
                          handleEpisodeChange(
                            episode.id,
                          )
                        }
                        className={`
                          group
                          w-full
                          rounded-2xl
                          border
                          p-3
                          text-left
                          transition
                          duration-200
                          ${
                            active
                              ? "border-[#d7af65]/30 bg-[#d7af65]/[0.055]"
                              : "border-transparent hover:border-white/10 hover:bg-white/[0.025]"
                          }
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={
                              episode.thumbnailSrc
                            }
                            alt=""
                            className="h-[74px] w-[74px] shrink-0 rounded-xl object-cover"
                            loading="lazy"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {index === 0 && (
                                <span className="rounded-full border border-[#d7af65]/20 bg-[#d7af65]/[0.045] px-2 py-0.5 text-[9px] uppercase tracking-wider text-[#d7af65]">
                                  New
                                </span>
                              )}

                              {episodeIsFree ? (
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] text-slate-400">
                                  Free
                                </span>
                              ) : (
                                !isSubscriber && (
                                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-slate-600">
                                    Members
                                  </span>
                                )
                              )}
                            </div>

                            <p className="line-clamp-2 text-sm font-medium leading-snug text-white">
                              {episode.title}
                            </p>

                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                              {
                                episode.description
                              }
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  },
                )}
              </CardContent>
            </Card>

            {/* =====================================
                SELECTED STORY
            ===================================== */}

            <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-[#07101a] text-white shadow-[0_25px_80px_rgba(0,0,0,.26)]">
              <div className="relative overflow-hidden bg-black">
                <img
                  src={
                    selectedEpisode.thumbnailSrc
                  }
                  alt={
                    selectedEpisode.title
                  }
                  className="aspect-video w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#07101a] via-transparent to-black/10" />

                <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                  <Badge className="rounded-full border border-white/10 bg-black/65 text-xs font-normal text-white backdrop-blur">
                    {selectedIsFree
                      ? "Free full episode"
                      : "Members"}
                  </Badge>

                  {hasAccess && (
                    <Badge className="rounded-full border border-[#d7af65]/20 bg-[#d7af65]/90 text-xs font-normal text-black">
                      Ready to Play
                    </Badge>
                  )}
                </div>
              </div>

              <CardContent className="p-6 sm:p-8">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d7af65]">
                  Night Listener
                </p>

                <h2 className="mt-3 max-w-4xl text-2xl font-medium leading-tight tracking-[-0.03em] sm:text-3xl">
                  {selectedEpisode.title}
                </h2>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
                  {
                    selectedEpisode.description
                  }
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {selectedEpisode.tags.map(
                    (tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1 text-xs text-slate-500"
                      >
                        {tag}
                      </span>
                    ),
                  )}
                </div>

                {/* PLAYER */}

                <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {selectedIsFree
                          ? "Listen free"
                          : "Your listening session"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {selectedIsFree
                          ? "This complete story is included free."
                          : "Full playback is included with your Night Listener membership."}
                      </p>
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-400">
                      Secure Playback
                    </span>
                  </div>

                  {status && (
                    <p className="mt-4 text-xs leading-6 text-slate-500">
                      {status}
                    </p>
                  )}

                  {loading ? (
                    <div className="mt-5 rounded-xl border border-white/10 bg-[#03070d] p-4">
                      <p className="text-sm text-slate-400">
                        Preparing your story…
                      </p>
                    </div>
                  ) : signedUrl ? (
                    <div className="mt-5">
                      <audio
                        key={signedUrl}
                        controls
                        preload="metadata"
                        className="w-full"
                        src={signedUrl}
                        onPlay={(e) => {
                          stopOtherAudio(
                            e.currentTarget,
                          );

                          trackEvent(
                            "member_episode_play",
                            {
                              episode_id:
                                episodeId,
                              episode_title:
                                selectedEpisode.title,
                            },
                          );
                        }}
                      />

                      <p className="mt-3 text-xs italic leading-5 text-slate-600">
                        Tip: headphones + low
                        volume work beautifully
                        for quiet listening.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5">
                      {!selectedIsFree &&
                        !isSubscriber && (
                          <div className="rounded-2xl border border-[#d7af65]/20 bg-[#d7af65]/[0.045] p-5">
                            <p className="text-sm font-medium text-white">
                              Full Library Access
                            </p>

                            <p className="mt-3 text-sm leading-7 text-slate-400">
                              Membership opens
                              this story and the
                              complete Night
                              Listener collection.
                            </p>

                            <Button
                              asChild
                              className="mt-5 rounded-full bg-[#d7af65] px-6 text-black hover:bg-[#e7ca90]"
                            >
                              <Link to="/join">
                                Unlock the Full
                                Library —
                                $4.99/month
                              </Link>
                            </Button>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* =========================================
            BOTTOM NOTE
        ========================================= */}

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-[#050a11] px-6 py-9 text-center sm:px-10 sm:py-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d7af65]">
            Night Listener
          </p>

          <h2 className="mx-auto mt-4 max-w-2xl text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
            Come back whenever you need
            something quiet.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            New stories and reflections are added
            to the Night Listener library as the
            collection grows.
          </p>

          <Link
            to="/listen"
            className="mt-6 inline-block text-sm text-[#d7af65] underline underline-offset-4 transition hover:text-[#efd296]"
          >
            Explore Night Listener
          </Link>
        </section>
      </div>
    </section>
  );
}