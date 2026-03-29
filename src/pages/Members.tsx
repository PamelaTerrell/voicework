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

const FREE_EPISODE_ID = "say-sorry-ep3";

const EPISODES: MemberEpisode[] = [
  {
    id: "versions-ep5",
    title: "The Versions We Never Meant to See",
    description:
      "A quiet story about how two people can care deeply for each other—yet slowly begin responding to versions of each other that were never really there.",
    thumbnailSrc: "/images/never-meant-to-see.png",
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
  {
    id: "say-sorry-ep3",
    title: "You Were Right… But You Never Said Sorry",
    description:
      "A quiet reflection on being right, the moment you almost apologized, and what it cost you not to.",
    thumbnailSrc: "/images/say-sorry.png",
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
  id: "im-fine-ep6",
  title: "Why We Say “I’m Fine” When It’s Not",
  description:
    "A quiet story about the small moments we dismiss, the things we don’t say, and how something subtle can quietly shift a connection.",
  thumbnailSrc: "/images/im-fine.png",
  tags: ["story", "relationships", "human behavior"],
}
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

  const now = Date.now();
  const end = timestamp * 1000;
  const diff = end - now;

  if (diff <= 0) return 0;

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function Members() {
  const [episodeId, setEpisodeId] = useState(FREE_EPISODE_ID);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [cancellationScheduled, setCancellationScheduled] = useState(false);
  const [cancellationEffectiveAt, setCancellationEffectiveAt] = useState<number | null>(null);
  const [, setSubscriptionStatus] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");

  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");

  const selectedEpisode = useMemo(
    () => EPISODES.find((ep) => ep.id === episodeId) ?? EPISODES[0],
    [episodeId]
  );

  const isFreeEpisode = episodeId === FREE_EPISODE_ID;
  const formattedEndDate = formatDate(cancellationEffectiveAt);
  const daysRemaining = getDaysRemaining(cancellationEffectiveAt);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
      setSessionUserId(data.session?.user.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
      setSessionUserId(session?.user.id ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSendMagicLink() {
    setLoginLoading(true);
    setLoginMessage("");

    try {
      const { error } = await sendMagicLink(loginEmail);

      if (error) {
        setLoginMessage(error.message);
        return;
      }

      setLoginMessage(
        "Your sign-in link is on its way. Open your email and return with the same address you used for membership."
      );
      setLoginEmail("");
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
    setCancellationScheduled(false);
    setCancellationEffectiveAt(null);
    setStripeCustomerId(null);
  }

  async function checkMemberAccess(email: string) {
    setCheckingAccess(true);
    setCancelMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id ?? sessionUserId ?? "";

      const r = await fetch(
        `/api/member-access?email=${encodeURIComponent(
          email
        )}&userId=${encodeURIComponent(userId)}`
      );
      const j: MemberAccessResponse = await r.json();

      if (!r.ok) {
        setIsSubscriber(false);
        setCancellationScheduled(false);
        setCancellationEffectiveAt(null);
        setStripeCustomerId(null);
        setSubscriptionStatus(null);
        setStatus(j.error || "Unable to verify membership.");
        return false;
      }

      setStripeCustomerId(j.profile?.stripe_customer_id ?? null);

      const active =
        !!j.isSubscriber ||
        isActiveStatus(j.profile?.subscription_status) ||
        isActiveStatus(j.subscription?.status);

      setIsSubscriber(active);
      setCancellationScheduled(!!j.cancellationScheduled);
      setCancellationEffectiveAt(j.cancellationEffectiveAt ?? null);
      setSubscriptionStatus(
        j.profile?.subscription_status ?? j.subscription?.status ?? null
      );

      return active;
    } catch (error) {
      setIsSubscriber(false);
      setCancellationScheduled(false);
      setCancellationEffectiveAt(null);
      setStripeCustomerId(null);
      setSubscriptionStatus(null);
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to verify membership."
      );
      return false;
    } finally {
      setCheckingAccess(false);
    }
  }

  async function fetchSignedUrl(selectedId = episodeId) {
    setLoading(true);
    setStatus("");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const email = data.session?.user.email ?? null;
    const selectedIsFree = selectedId === FREE_EPISODE_ID;

    if (!token || !email) {
      setSignedUrl(null);
      setIsSubscriber(false);
      setCancellationScheduled(false);
      setCancellationEffectiveAt(null);
      setStripeCustomerId(null);
      setSubscriptionStatus(null);

      setStatus(
        selectedIsFree
          ? "Sign in below if you'd like to open this story here in your library."
          : "This story is waiting inside the full Night Listener library."
      );

      setLoading(false);
      return;
    }

    const hasMembership = await checkMemberAccess(email);

    try {
      const r = await fetch(
        `/api/signed-audio?episodeId=${encodeURIComponent(selectedId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const j = await r.json();

      if (!r.ok) {
        setSignedUrl(null);

        if (!hasMembership && selectedIsFree && r.status === 403) {
          setStatus(
            "This story is marked as free, but playback is still being blocked. Update /api/signed-audio to allow the free episode."
          );
        } else if (!hasMembership && r.status === 403) {
          setStatus(
            "This story is waiting inside the full Night Listener library. Unlock membership to continue."
          );
        } else {
          setStatus(`Error ${r.status}: ${j.error || "Unknown error"}`);
        }

        setLoading(false);
        return;
      }

      setSignedUrl(j.url);

      if (hasMembership) {
        setStatus("Your library is open.");
      } else if (selectedIsFree) {
        setStatus("This story is ready for you.");
      } else {
        setStatus("Your story is ready.");
      }

      const loadedEpisode =
        EPISODES.find((ep) => ep.id === selectedId) ?? selectedEpisode;

      trackEvent("member_episode_load", {
        episode_id: selectedId,
        episode_title: loadedEpisode.title,
        is_subscriber: hasMembership,
        is_free_episode: selectedIsFree,
      });
    } catch (error) {
      setSignedUrl(null);
      setStatus(
        error instanceof Error
          ? error.message
          : "Something went wrong while opening your story."
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
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setCancelMessage("Please sign in first.");
        return;
      }

      const r = await fetch("/api/cancel-membership", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const j = await r.json();

      if (!r.ok) {
        setCancelMessage(j.error || "Unable to cancel membership.");
        return;
      }

      setCancelMessage(
        j.message ||
          "Your membership has been canceled. You should keep access until the end of your current billing period."
      );

      trackEvent("member_cancel_membership", {
        email: sessionEmail,
      });

      if (sessionEmail) {
        await checkMemberAccess(sessionEmail);
      }

      setSignedUrl(null);
    } catch (error) {
      setCancelMessage(
        error instanceof Error
          ? error.message
          : "Unable to cancel membership."
      );
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleResumeMembership() {
    if (!stripeCustomerId) {
      setCancelMessage(
        "Unable to resume membership right now. Please refresh and try again."
      );
      return;
    }

    try {
      const r = await fetch("/api/resume-membership", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: stripeCustomerId,
        }),
      });

      const j = await r.json();

      if (!r.ok) {
        setCancelMessage(j.error || "Unable to resume membership.");
        return;
      }

      if (j.url) {
        window.location.href = j.url;
      }
    } catch (error) {
      setCancelMessage(
        error instanceof Error
          ? error.message
          : "Unable to resume membership."
      );
    }
  }

  useEffect(() => {
    if (sessionEmail) {
      fetchSignedUrl(episodeId);
    } else {
      setSignedUrl(null);
      setIsSubscriber(false);
      setCancellationScheduled(false);
      setCancellationEffectiveAt(null);
      setStripeCustomerId(null);
      setSubscriptionStatus(null);
      setStatus(
        episodeId === FREE_EPISODE_ID
          ? "Choose the free featured story to begin, or sign in to open your library."
          : ""
      );
      setCancelMessage("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEmail]);

  useEffect(() => {
    if (sessionEmail) {
      fetchSignedUrl(episodeId);
    } else {
      setSignedUrl(null);
      setStatus(
        episodeId === FREE_EPISODE_ID
          ? "Sign in below if you'd like to open this story here in your library."
          : "This story is waiting inside the full Night Listener library. Sign in or subscribe to continue."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  function handleEpisodeChange(id: string) {
    setEpisodeId(id);

    const nextEpisode = EPISODES.find((ep) => ep.id === id);

    trackEvent("member_episode_select", {
      episode_id: id,
      episode_title: nextEpisode?.title,
      is_free_episode: id === FREE_EPISODE_ID,
    });
  }

  const isSignedIn = Boolean(sessionEmail);
  const hasAccess = Boolean(signedUrl);
  const showCancelButton =
    isSignedIn && isSubscriber && !cancellationScheduled;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border bg-muted/30 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Night Listener
            </div>

            {isSignedIn ? (
              <Badge className="font-normal">Signed In</Badge>
            ) : (
              <Badge variant="secondary" className="font-normal">
                Not Signed In
              </Badge>
            )}

            {isSubscriber && !cancellationScheduled && (
              <Badge variant="secondary" className="font-normal">
                Active Member
              </Badge>
            )}

            {isSubscriber && cancellationScheduled && (
              <Badge variant="secondary" className="font-normal">
                Ends Soon
              </Badge>
            )}

            {hasAccess && (
              <Badge variant="secondary" className="font-normal">
                Ready to Play
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your library
            </h1>
            <p className="max-w-3xl text-muted-foreground">
              A quiet place for the full Night Listener experience—thoughtful
              stories, gentle reflection, and the moments that stay with us.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-border/70 bg-muted/20 p-5 shadow-sm">
          {isSignedIn ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Welcome back.</p>
                <p className="text-xs text-muted-foreground">{sessionEmail}</p>

                <p className="text-sm leading-7 text-muted-foreground">
                  {checkingAccess
                    ? "Checking your library access…"
                    : isSubscriber && cancellationScheduled
                    ? `Your membership remains active until ${
                        formattedEndDate ?? "the end of your billing period"
                      }${
                        daysRemaining !== null
                          ? ` (${daysRemaining} day${
                              daysRemaining === 1 ? "" : "s"
                            } remaining)`
                          : ""
                      }.`
                    : isSubscriber
                    ? "Your library is open. You have access to the full Night Listener collection."
                    : "You're signed in. You can begin with the free featured story below, or unlock the full library anytime."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={signOut}>
                  Sign out
                </Button>

                {!isSubscriber && (
                  <Button asChild>
                    <Link to="/join">Unlock the full library</Link>
                  </Button>
                )}

                {isSubscriber && cancellationScheduled && (
                  <Button onClick={handleResumeMembership}>
                    Resume membership
                  </Button>
                )}

                {showCancelButton && (
                  <button
                    type="button"
                    onClick={handleCancelMembership}
                    disabled={cancelLoading}
                    className="rounded-xl border border-border/70 bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancelLoading ? "Canceling…" : "Cancel membership"}
                  </button>
                )}
              </div>

              {isSubscriber && cancellationScheduled && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Access continues until{" "}
                  <span className="font-medium">
                    {formattedEndDate ?? "the end of your billing period"}
                  </span>
                  .
                </p>
              )}

              {showCancelButton && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  If you cancel, your library should remain open through the end
                  of your current billing period.
                </p>
              )}

              {cancelMessage && (
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-sm text-muted-foreground">
                    {cancelMessage}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Your Night Listener library is waiting.
                </p>
                <p className="text-sm leading-7 text-muted-foreground">
                  Enter your email and we’ll send you a link back to your stories.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="sm:max-w-sm"
                />

                <Button
                  onClick={handleSendMagicLink}
                  disabled={!loginEmail || loginLoading}
                >
                  {loginLoading ? "Sending…" : "Send magic link"}
                </Button>
              </div>

              {loginMessage && (
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-sm text-muted-foreground">
                    {loginMessage}
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Want the full library? Membership unlocks every episode.
              </p>
            </div>
          )}
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden rounded-[28px] border border-border/70">
          <div className="border-b px-6 py-5">
            <p className="text-sm font-medium">Library shelf</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Browse stories and select where to begin.
            </p>
          </div>

          <CardContent className="space-y-3 p-4">
            {EPISODES.map((ep) => {
              const isActive = ep.id === episodeId;
              const epIsFree = ep.id === FREE_EPISODE_ID;

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

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">
                          {ep.title}
                        </p>

                        {epIsFree ? (
                          <Badge
                            variant="secondary"
                            className="rounded-full px-2 py-0.5 text-[10px] font-normal"
                          >
                            Free
                          </Badge>
                        ) : !isSubscriber ? (
                          <Badge
                            variant="outline"
                            className="rounded-full px-2 py-0.5 text-[10px] font-normal"
                          >
                            Members
                          </Badge>
                        ) : null}
                      </div>

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

        <Card className="overflow-hidden rounded-[28px] border border-border/70 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
          <div className="relative bg-[#0b0f19]">
            <img
              src={selectedEpisode.thumbnailSrc}
              alt={selectedEpisode.title}
              className="mx-auto max-h-[420px] w-full object-contain"
              loading="lazy"
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />

            <div className="absolute right-4 top-4 flex gap-2">
              <Badge className="border-white/20 bg-black/40 text-white shadow-sm backdrop-blur">
                {isFreeEpisode ? "Story" : "Members"}
              </Badge>

              {hasAccess && (
                <Badge
                  variant="secondary"
                  className="bg-white/80 shadow-sm backdrop-blur"
                >
                  Ready to Play
                </Badge>
              )}
            </div>
          </div>

          <CardContent className="space-y-6 p-6">
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Selected story
                </p>
                <h2 className="text-2xl font-semibold leading-tight tracking-tight">
                  {selectedEpisode.title}
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  {selectedEpisode.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
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
                  <p className="text-sm font-medium">
                    {isFreeEpisode ? "Your featured story" : "Your listening session"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isFreeEpisode
                      ? "This featured story is also available on the home page."
                      : "Membership unlocks this full story and the rest of the library."}
                  </p>
                </div>

                <Badge variant="secondary" className="font-normal">
                  Secure Playback
                </Badge>
              </div>

              {status && (
                <div className="mt-4 rounded-xl border bg-background p-3">
                  <p className="text-sm text-muted-foreground">{status}</p>
                </div>
              )}

              {loading ? (
                <div className="mt-5 rounded-xl border bg-background p-4">
                  <p className="text-sm font-medium">Preparing your story…</p>
                </div>
              ) : signedUrl ? (
                <div className="mt-5 space-y-3">
                  <p className="text-sm font-medium">Now playing</p>
                  <p className="text-xs text-muted-foreground">
                    {isFreeEpisode
                      ? "Settle in. This featured story is ready."
                      : "Settle in. Your full Night Listener experience is ready."}
                  </p>

                  <audio
                    key={signedUrl}
                    controls
                    preload="none"
                    className="w-full"
                    src={signedUrl}
                  />

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Your secure link expires after a short time. If playback
                    stops, reselect the episode or refresh the page.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-4 rounded-xl border bg-background p-4">
                  <p className="text-sm font-medium">
                    {isFreeEpisode
                      ? "This featured story is available for free on the home page. Sign in if you'd like to open it here in your library."
                      : isSignedIn
                      ? "This story is waiting inside the full Night Listener library. Unlock membership to continue."
                      : "This story is waiting inside the full Night Listener library. Sign in or subscribe to continue."}
                  </p>

                  {!isSubscriber && !isFreeEpisode && (
                    <Button asChild className="w-full sm:w-auto">
                      <Link to="/join">Unlock the full library</Link>
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-background p-5">
              <p className="text-sm font-medium">A quiet note</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Begin with the free featured story whenever you like. When
                you’re ready for more, membership unlocks the full growing
                Night Listener library.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}