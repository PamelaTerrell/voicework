import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
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
  profile?: {
    id: string;
    email: string | null;
    is_subscriber: boolean | null;
    subscription_status: string | null;
  } | null;
  error?: string;
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

function isActiveStatus(status?: string | null) {
  return status === "active" || status === "trialing";
}

export default function Members() {
  const [episodeId, setEpisodeId] = useState("conversation-ep2");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");

  const selectedEpisode = useMemo(
    () => EPISODES.find((ep) => ep.id === episodeId) ?? EPISODES[0],
    [episodeId]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendMagicLink() {
    setLoginLoading(true);
    setLoginMessage("");

    try {
      const redirectTo =
        window.location.hostname === "localhost"
          ? "http://localhost:5173/auth/callback?next=/members"
          : "https://www.stabileusa.com/auth/callback?next=/members";

      const { error } = await supabase.auth.signInWithOtp({
        email: loginEmail,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setLoginMessage(error.message);
        return;
      }

      setLoginMessage(
        "Your quiet sign-in link is on its way. Open your email and return with the same address you used in Stripe."
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
  }

  async function checkMemberAccess(email: string) {
    setCheckingAccess(true);
    setCancelMessage("");

    try {
      const r = await fetch(
        `/api/member-access?email=${encodeURIComponent(email)}`
      );
      const j: MemberAccessResponse = await r.json();

      if (!r.ok) {
        setIsSubscriber(false);
        setSubscriptionStatus(null);
        setStatus(j.error || "Unable to verify membership.");
        return false;
      }

      const active =
        !!j.isSubscriber || isActiveStatus(j.profile?.subscription_status);

      setIsSubscriber(active);
      setSubscriptionStatus(j.profile?.subscription_status ?? null);

      return active;
    } catch (error) {
      setIsSubscriber(false);
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

    if (!token || !email) {
      setSignedUrl(null);
      setIsSubscriber(false);
      setSubscriptionStatus(null);
      setStatus(
        "Your library is waiting. Sign in below to continue listening."
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

        if (!hasMembership && r.status === 403) {
          setStatus(
            "You’re signed in, but we don’t yet see an active membership or unlock on this email address."
          );
        } else {
          setStatus(`Error ${r.status}: ${j.error || "Unknown error"}`);
        }

        setLoading(false);
        return;
      }

      setSignedUrl(j.url);

      if (hasMembership) {
        setStatus("Your full Night Listener library is open.");
      } else {
        setStatus("This episode is now ready for you.");
      }

      const loadedEpisode =
        EPISODES.find((ep) => ep.id === selectedId) ?? selectedEpisode;

      trackEvent("member_episode_load", {
        episode_id: selectedId,
        episode_title: loadedEpisode.title,
        is_subscriber: hasMembership,
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

  useEffect(() => {
    if (sessionEmail) {
      fetchSignedUrl(episodeId);
    } else {
      setSignedUrl(null);
      setIsSubscriber(false);
      setSubscriptionStatus(null);
      setStatus("");
      setCancelMessage("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEmail]);

  useEffect(() => {
    if (sessionEmail) {
      fetchSignedUrl(episodeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  function handleEpisodeChange(id: string) {
    setEpisodeId(id);

    const nextEpisode = EPISODES.find((ep) => ep.id === id);

    trackEvent("member_episode_select", {
      episode_id: id,
      episode_title: nextEpisode?.title,
    });
  }

  const isSignedIn = Boolean(sessionEmail);
  const hasAccess = Boolean(signedUrl);
  const showCancelButton = isSignedIn && isSubscriber;

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

            {isSubscriber && (
              <Badge variant="secondary" className="font-normal">
                Active Member
              </Badge>
            )}

            {hasAccess && (
              <Badge variant="secondary" className="font-normal">
                Full Access
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your library
            </h1>
            <p className="max-w-3xl text-muted-foreground">
              A quiet place for the full Night Listener experience — thoughtful
              stories, gentle reflection, and late-night listening made to meet
              you softly.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-border/70 bg-muted/20 p-5 shadow-sm">
          {isSignedIn ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Welcome back.</p>
                <p className="text-xs text-muted-foreground">{sessionEmail}</p>

                <p className="text-sm text-muted-foreground leading-7">
                  {checkingAccess
                    ? "Checking your library access…"
                    : isSubscriber
                    ? "Your membership is active. Your full Night Listener library is open."
                    : "You’re signed in, but we don’t yet see an active membership on this email address. If you subscribed, make sure you used this same email in Stripe."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={signOut}>
                  Sign out
                </Button>

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
                <p className="text-sm text-muted-foreground leading-7">
                  Enter your email and we’ll send you a quiet link back to your
                  stories.
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
                  onClick={sendMagicLink}
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
            </div>
          )}
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden rounded-[28px] border border-border/70">
          <div className="border-b px-6 py-5">
            <p className="text-sm font-medium">Tonight’s shelf</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose a story and settle in.
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

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">
                          {ep.title}
                        </p>

                        {!isSubscriber && (
                          <Badge
                            variant="outline"
                            className="rounded-full px-2 py-0.5 text-[10px] font-normal"
                          >
                            Library
                          </Badge>
                        )}
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

        <Card className="overflow-hidden rounded-[28px] border border-border/70 shadow-sm">
          <div className="relative">
            <img
              src={selectedEpisode.thumbnailSrc}
              alt={selectedEpisode.title}
              className="h-64 w-full object-cover sm:h-72"
              loading="lazy"
            />
            <div className="absolute right-4 top-4 flex gap-2">
              <Badge className="shadow-sm">Members</Badge>
              {hasAccess && (
                <Badge variant="secondary" className="shadow-sm">
                  Ready to Play
                </Badge>
              )}
            </div>
          </div>

          <CardContent className="space-y-6 p-6">
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Tonight’s story
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
                  <p className="text-sm font-medium">Your full story</p>
                  <p className="text-xs text-muted-foreground">
                    Your listening session opens here automatically once access
                    is confirmed.
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
                    Settle in. This is your full Night Listener experience.
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
                <div className="mt-5 rounded-xl border bg-background p-4">
                  <p className="text-sm font-medium">
                    {isSignedIn
                      ? "Choose a story from your shelf to begin listening."
                      : "This story is part of your Night Listener library. Sign in to continue listening."}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-background p-5">
              <p className="text-sm font-medium">A quiet note</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                If you unlocked a single episode, only that story will play
                here. If you subscribed as a member, your full library should be
                ready whenever you return.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}