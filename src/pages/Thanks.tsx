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
      <style>{`
        @keyframes driftStars {
          0% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -10px, 0);
          }
          100% {
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes pulseStar {
          0%, 100% {
            opacity: 0.35;
            transform: scale(1);
          }
          50% {
            opacity: 0.75;
            transform: scale(1.08);
          }
        }

        .stars-layer {
          animation: driftStars 18s ease-in-out infinite;
        }

        .twinkle-star {
          animation: pulseStar 4.8s ease-in-out infinite;
        }

        .twinkle-star-delayed {
          animation: pulseStar 6.2s ease-in-out infinite;
          animation-delay: 1.2s;
        }

        .twinkle-star-slow {
          animation: pulseStar 7.4s ease-in-out infinite;
          animation-delay: 2.2s;
        }
      `}</style>

      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-120px] h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-[#ece7ff] opacity-45 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-80px] h-[260px] w-[260px] rounded-full bg-[#f4f1ff] opacity-45 blur-3xl" />
        <div className="absolute left-[-80px] top-[30%] h-[220px] w-[220px] rounded-full bg-[#f7f3ff] opacity-40 blur-3xl" />

        <div
          className="stars-layer absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage: `
              radial-gradient(1.5px 1.5px at 20px 30px, #d9d2ff, transparent),
              radial-gradient(1px 1px at 80px 120px, #d7d1f8, transparent),
              radial-gradient(1.5px 1.5px at 140px 60px, #e5e1ff, transparent),
              radial-gradient(1px 1px at 220px 160px, #ddd8ff, transparent),
              radial-gradient(1.5px 1.5px at 300px 90px, #ebe8ff, transparent),
              radial-gradient(1px 1px at 40px 170px, #dcd6ff, transparent),
              radial-gradient(1.5px 1.5px at 180px 25px, #e7e3ff, transparent)
            `,
            backgroundSize: "260px 200px",
          }}
        />

        {/* A few brighter stars */}
        <span className="twinkle-star absolute left-[12%] top-[18%] h-1.5 w-1.5 rounded-full bg-[#d7d0ff]" />
        <span className="twinkle-star-delayed absolute right-[18%] top-[22%] h-1.5 w-1.5 rounded-full bg-[#d7d0ff]" />
        <span className="twinkle-star-slow absolute left-[22%] bottom-[20%] h-1.5 w-1.5 rounded-full bg-[#d7d0ff]" />
        <span className="twinkle-star absolute right-[14%] bottom-[26%] h-1.5 w-1.5 rounded-full bg-[#e6e1ff]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <Card className="w-full overflow-hidden rounded-[2rem] border border-[#e8e4dc] bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-sm">
          <CardContent className="px-8 py-14 text-center sm:px-12">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-[#e8e4dc] bg-[#f9f7fc] text-xl shadow-sm">
              🌙
            </div>

            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#9a90b0]">
              Welcome
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Welcome, Night Listener 🌙
            </h1>

            <p className="mt-4 text-base leading-7 text-[#6b645c] sm:text-lg">
              Welcome to a quieter space. Your listening experience is ready whenever you are.
            </p>

            <div className="mx-auto mt-8 h-px w-20 bg-gradient-to-r from-transparent via-[#d8cfc4] to-transparent" />

            <p className="mx-auto mt-6 max-w-md text-sm leading-7 text-[#8a8175]">
              Take your time. There’s no rush here. When you’re ready, your next story is waiting.
            </p>

            <div className="mt-10">
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
                      cta_label: "Open Members",
                    })
                  }
                >
                  Open Members
                </Link>
              </Button>
            </div>

            <div className="mt-6">
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