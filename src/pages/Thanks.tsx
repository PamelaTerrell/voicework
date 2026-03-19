import { Link, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function trackEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", eventName, {
      site: "stabileusa",
      page_name: "thanks",
      page_location: window.location.pathname + window.location.search,
      ...params,
    });
  }
}

export default function Thanks() {
  const [searchParams] = useSearchParams();

  const from = searchParams.get("from");
  const product = searchParams.get("product");

  const isNightList = from === "night_list";
  const isContact = from === "contact";
  const isStripe = from === "stripe";
  const isMembership = product === "membership";
  const isSingle = product === "single";

  useEffect(() => {
    if (isNightList) {
      trackEvent("night_list_signup_success", {
        source: "night_list",
      });
      return;
    }

    if (isContact) {
      trackEvent("contact_success", {
        source: "contact_form",
      });
      return;
    }

    if (isStripe && isMembership) {
      trackEvent("purchase_success", {
        product_type: "membership",
        value: 4.99,
        currency: "USD",
      });

      trackEvent("membership_success", {
        product_type: "membership",
        plan: "monthly_membership",
        value: 4.99,
        currency: "USD",
      });
      return;
    }

    if (isStripe && isSingle) {
      trackEvent("purchase_success", {
        product_type: "single_episode",
        value: 2.99,
        currency: "USD",
      });

      trackEvent("single_episode_success", {
        product_type: "single_episode",
        value: 2.99,
        currency: "USD",
      });
      return;
    }

    trackEvent("thanks_page_view", {
      source: from || "unknown",
      product_type: product || "none",
    });
  }, [isNightList, isContact, isStripe, isMembership, isSingle, from, product]);

  let title = "Thank you 🌙";
  let subtitle = "You’re all set.";

  if (isNightList) {
    title = "You’re on the Night List 🌙";
    subtitle =
      "You’ll get new episode releases, early access, and occasional cozy notes.";
  } else if (isContact) {
    title = "Thank you!";
    subtitle =
      "Your message was sent successfully. I’ll get back to you as soon as I can.";
  } else if (isStripe && isMembership) {
    title = "Welcome, Night Listener 🌙";
    subtitle =
      "Your membership is active. Thank you for supporting this project.";
  } else if (isStripe && isSingle) {
    title = "You’re all set 🌙";
    subtitle =
      "Your episode is unlocked. Thank you for listening and supporting this work.";
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </header>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="rounded-2xl border bg-background p-5">
            <p className="text-sm font-medium">What happens next</p>

            {isNightList && (
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>• New previews will appear on the Listen page</li>
                <li>• The Night List gets first access when new episodes launch</li>
                <li>• You’ll receive occasional cozy notes (no spam)</li>
              </ul>
            )}

            {isContact && (
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>• I’ll reply with timing and any clarifying questions</li>
                <li>• If you have a script, feel free to include it in your reply</li>
                <li>• Delivery formats available: WAV or MP3</li>
              </ul>
            )}

            {isStripe && (
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>• A Stripe receipt has been sent to your email</li>
                <li>• Sign in with the same email address you used at checkout</li>
                <li>• Then open your Members library to listen</li>
              </ul>
            )}

            {!isNightList && !isContact && !isStripe && (
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>• You can listen to previews anytime</li>
                <li>• Join the Night List for updates and early access</li>
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {isStripe ? (
              <Button asChild className="h-11">
                <Link
                  to="/members"
                  onClick={() =>
                    trackEvent("thanks_nav_click", {
                      destination: "/members",
                      cta_label: "Go to Members",
                      context: "post_purchase",
                    })
                  }
                >
                  Go to Members
                </Link>
              </Button>
            ) : (
              <Button asChild className="h-11">
                <Link
                  to="/listen"
                  onClick={() =>
                    trackEvent("thanks_nav_click", {
                      destination: "/listen",
                      cta_label: "Listen",
                      context: isNightList
                        ? "night_list"
                        : isContact
                        ? "contact"
                        : "general",
                    })
                  }
                >
                  Listen
                </Link>
              </Button>
            )}

            <Button asChild variant="outline" className="h-11">
              <Link
                to="/"
                onClick={() =>
                  trackEvent("thanks_nav_click", {
                    destination: "/",
                    cta_label: "Back to home",
                    context: isStripe
                      ? "post_purchase"
                      : isNightList
                      ? "night_list"
                      : isContact
                      ? "contact"
                      : "general",
                  })
                }
              >
                Back to home
              </Link>
            </Button>
          </div>

          {!isStripe && (
            <div className="rounded-2xl border bg-muted/30 p-5">
              <p className="text-sm font-medium">Want full episodes?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Join as a Night Listener to unlock the full library and support future episodes.
              </p>
              <Button asChild className="mt-3 w-full sm:w-auto">
                <Link
                  to="/join"
                  onClick={() =>
                    trackEvent("thanks_cta_click", {
                      destination: "/join",
                      cta_label: "View access options",
                      context: isNightList
                        ? "night_list"
                        : isContact
                        ? "contact"
                        : "general",
                    })
                  }
                >
                  View access options
                </Link>
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Prefer email?{" "}
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="mailto:agentpamelajterrell@gmail.com"
              onClick={() =>
                trackEvent("thanks_cta_click", {
                  cta_label: "email",
                  destination: "mailto:agentpamelajterrell@gmail.com",
                  context: isStripe
                    ? "post_purchase"
                    : isNightList
                    ? "night_list"
                    : isContact
                    ? "contact"
                    : "general",
                })
              }
            >
              agentpamelajterrell@gmail.com
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}