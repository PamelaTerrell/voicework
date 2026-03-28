import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function trackEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", eventName, {
      site: "stabileusa",
      page_name: "thanks",
      page_location: window.location.pathname,
      ...params,
    });
  }
}

export default function Thanks() {
  useEffect(() => {
    trackEvent("membership_success", {
      plan: "monthly_membership",
      value: 4.99,
    });
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-[#2d2a26]">
      {/* background stays the same */}

      <div className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <Card className="w-full overflow-hidden rounded-[2rem] border border-[#e8e4dc] bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-sm">
          <CardContent className="px-8 py-14 text-center sm:px-12">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-[#e8e4dc] bg-[#f9f7fc] text-xl shadow-sm">
              🌙
            </div>

            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#9a90b0]">
              You’re in
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Welcome, Night Listener
            </h1>

            <p className="mt-4 text-base leading-7 text-[#6b645c] sm:text-lg">
              You now have full access to the Night Listener library—
              a collection of stories about the moments, emotions, and patterns
              we all recognize.
            </p>

            <div className="mx-auto mt-8 h-px w-20 bg-gradient-to-r from-transparent via-[#d8cfc4] to-transparent" />

            <p className="mx-auto mt-6 max-w-md text-sm leading-7 text-[#8a8175]">
              Start anywhere. Follow what feels familiar.  
              The next story might feel closer than you expect.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-[#2d2a26] px-8 text-white shadow-[0_10px_24px_rgba(45,42,38,0.12)] transition hover:bg-[#1f1c19]"
              >
                <Link
                  to="/members"
                  onClick={() =>
                    trackEvent("thanks_nav_click", {
                      destination: "/members",
                      cta_label: "Start Listening",
                    })
                  }
                >
                  Start listening
                </Link>
              </Button>

              <Link
                to="/listen"
                className="text-sm text-[#8a8175] transition hover:text-[#2d2a26]"
                onClick={() =>
                  trackEvent("thanks_nav_click", {
                    destination: "/listen",
                    cta_label: "Browse Stories",
                  })
                }
              >
                or explore more stories first
              </Link>
            </div>

            <div className="mt-8">
              <Link
                to="/"
                className="text-xs text-[#8a8175] transition hover:text-[#2d2a26]"
              >
                Back to home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}