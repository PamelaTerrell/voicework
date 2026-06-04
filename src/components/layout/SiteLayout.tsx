import { Link, NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Auth } from "@/components/Auth";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "text-sm transition-colors",
          isActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")
      }
      end={to === "/"}
    >
      {label}
    </NavLink>
  );
}

export default function SiteLayout() {
  return (
    <div className="min-h-screen bg-background">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        {/* TOP ANNOUNCEMENT BAR */}
        <div className="border-b bg-muted/70 px-4 py-2 text-center text-sm text-muted-foreground">
          <a
            href="/#submit-story"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Submit a true story you still think about
          </a>
          <span className="hidden sm:inline">
            {" "}
            — selected stories may become future Night Listener episodes.
          </span>
        </div>

        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src="/images/night-listener.png"
              alt="Night Listener"
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />

            <div className="min-w-0 space-y-1">
              <div className="font-semibold tracking-tight text-foreground">
                Night Listener
              </div>

              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                A Stabile USA Product
              </div>
            </div>
          </Link>

          {/* DESKTOP NAV */}
          <nav className="hidden items-center gap-6 sm:flex">
            <NavItem to="/" label="Home" />
            <NavItem to="/listen" label="Listen" />
            <NavItem to="/join" label="Join" />
            <NavItem to="/contact" label="Contact" />
          </nav>

          {/* DESKTOP ACTIONS */}
          <div className="hidden items-center gap-2 lg:flex">
            <Button
              asChild
              variant="outline"
              className="hidden whitespace-nowrap sm:inline-flex"
            >
              <a href="/#submit-story">Submit a Story</a>
            </Button>

            <Button
              asChild
              variant="outline"
              className="hidden whitespace-nowrap sm:inline-flex"
            >
              <Link to="/listen">Play a preview</Link>
            </Button>

            <Button asChild className="hidden whitespace-nowrap sm:inline-flex">
              <Link to="/join">Unlock Membership</Link>
            </Button>
          </div>
        </div>

        {/* MOBILE + AUTH */}
        <div className="border-t">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:hidden">
              <div className="flex flex-wrap items-center gap-4">
                <NavItem to="/" label="Home" />
                <NavItem to="/listen" label="Listen" />
                <NavItem to="/join" label="Join" />
                <NavItem to="/contact" label="Contact" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href="/#submit-story">Submit</a>
                </Button>

                <Button asChild variant="outline" size="sm">
                  <Link to="/listen">Preview</Link>
                </Button>

                <Button asChild size="sm">
                  <Link to="/join">Join</Link>
                </Button>
              </div>
            </div>

            <div className="w-full">
              <Auth />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Outlet />
      </main>

      {/* FOOTER */}
      <footer className="mt-16">
        <Separator />

        <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="space-y-2">
              <div className="flex flex-col items-center gap-2">
                <img
                  src="/images/night-listener.png"
                  alt="Night Listener"
                  className="h-10 w-10 rounded-full"
                />

                <p className="text-base font-medium text-foreground">
                  Night Listener
                </p>

                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  A Stabile USA Product
                </p>
              </div>

              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                A quiet space for reflective stories, human behavior, and the
                moments that stay with us.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <a
                href="mailto:listen@stabileusa.com"
                className="transition hover:text-foreground"
              >
                Email
              </a>

              <a
                href="https://instagram.com/stabileusa"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="inline-flex items-center gap-2 transition hover:text-foreground"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <path d="M17.5 6.5h.01" />
                </svg>
                <span>Instagram</span>
              </a>

              <a
                href="/#submit-story"
                className="transition hover:text-foreground"
              >
                Submit a Story
              </a>

              <Link to="/contact" className="transition hover:text-foreground">
                Work with Me
              </Link>

              <Link to="/contact" className="transition hover:text-foreground">
                Voice Work
              </Link>

              <a
                href="https://pamelajterrell.com"
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-foreground"
              >
                Portfolio
              </a>
            </div>

            <p className="text-xs text-muted-foreground/70">
              Created and narrated by Pamela J. Terrell
            </p>
          </div>
        </div>
      </footer>

      <Analytics />
      <SpeedInsights />
    </div>
  );
}