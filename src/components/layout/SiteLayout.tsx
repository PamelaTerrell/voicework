import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Auth } from "@/components/Auth";
import { SafeAnalytics } from "@/components/SafeAnalytics";
import { shouldShowHeaderInlineAuth } from "@/lib/headerAuthVisibility";

function NavItem({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
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
  const location = useLocation();
  const showHeaderInlineAuth = shouldShowHeaderInlineAuth(location.pathname);

  return (
    <div className="min-h-screen w-full bg-background">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur">
        {/* TOP ANNOUNCEMENT BAR */}

        <div className="w-full border-b bg-muted/70 px-4 py-2 text-center text-sm text-muted-foreground">
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

        {/* MAIN HEADER ROW */}

        <div
          className="
            mx-auto
            flex
            w-full
            max-w-[1900px]
            items-center
            justify-between
            gap-4
            px-4
            py-3
            sm:px-6
            lg:px-10
            xl:px-16
            2xl:px-20
          "
        >
          <Link
            to="/"
            className="flex min-w-0 items-center gap-3"
          >
            <img
              src="/images/stabile-s-logo.png"
              alt="Stabile USA"
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />

            <div className="min-w-0 space-y-1">
              <div className="font-semibold tracking-tight text-foreground">
                Stabile USA
              </div>

              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Independent Digital Brand
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
              <a href="/#submit-story">
                Submit a Story
              </a>
            </Button>

            <Button
              asChild
              variant="outline"
              className="hidden whitespace-nowrap sm:inline-flex"
            >
              <Link to="/listen">
                Play a preview
              </Link>
            </Button>

            <Button
              asChild
              className="hidden whitespace-nowrap sm:inline-flex"
            >
              <Link to="/join">
                Unlock Membership
              </Link>
            </Button>
          </div>
        </div>

        {/* MOBILE + AUTH */}

        <div
          className={
            showHeaderInlineAuth
              ? "w-full border-t"
              : "w-full border-t sm:hidden"
          }
        >
          <div
            className="
              mx-auto
              flex
              w-full
              max-w-[1900px]
              flex-col
              gap-3
              px-4
              py-3
              sm:px-6
              lg:flex-row
              lg:items-center
              lg:justify-between
              lg:px-10
              xl:px-16
              2xl:px-20
            "
          >
            <div className="flex flex-col gap-3 sm:hidden">
              <div className="flex flex-wrap items-center gap-4">
                <NavItem to="/" label="Home" />
                <NavItem to="/listen" label="Listen" />
                <NavItem to="/join" label="Join" />
                <NavItem to="/contact" label="Contact" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                >
                  <a href="/#submit-story">
                    Submit
                  </a>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  size="sm"
                >
                  <Link to="/listen">
                    Preview
                  </Link>
                </Button>

                <Button
                  asChild
                  size="sm"
                >
                  <Link to="/join">
                    Join
                  </Link>
                </Button>
              </div>
            </div>

            {showHeaderInlineAuth && (
              <div className="w-full">
                <Auth />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ======================================================
          MAIN — FULL WIDTH
      ====================================================== */}

      <main className="w-full">
        <Outlet />
      </main>

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="mt-16 w-full">
        <Separator />

        <div
          className="
            mx-auto
            w-full
            max-w-[1900px]
            px-4
            py-10
            text-sm
            text-muted-foreground
            sm:px-6
            lg:px-10
            xl:px-16
            2xl:px-20
          "
        >
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="space-y-2">
              <div className="flex flex-col items-center gap-2">
                <img
                  src="/images/stabile-s-logo.png"
                  alt="Stabile USA"
                  className="h-10 w-10 rounded-full"
                />

                <p className="text-base font-medium text-foreground">
                  Stabile USA
                </p>

                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Independent Digital Brand
                </p>
              </div>

              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Original media, digital platforms,
                storytelling, information, and
                mission-driven projects.
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
                href="https://bsky.app/profile/stabileusa.bsky.social"
                target="_blank"
                rel="noreferrer"
                aria-label="Stabile USA on Bluesky"
                className="inline-flex items-center gap-2 transition hover:text-foreground"
              >
                <span aria-hidden="true">🦋</span>
                <span>Bluesky</span>
              </a>

              <a
                href="https://instagram.com/stabileusa"
                target="_blank"
                rel="noreferrer"
                aria-label="Stabile USA on Instagram"
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
                  <rect
                    x="2"
                    y="2"
                    width="20"
                    height="20"
                    rx="5"
                    ry="5"
                  />

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

              <Link
                to="/contact"
                className="transition hover:text-foreground"
              >
                Work with Me
              </Link>

              <Link
                to="/contact"
                className="transition hover:text-foreground"
              >
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
              Created and developed by Pamela J. Terrell
            </p>
          </div>
        </div>
      </footer>

      <SafeAnalytics />
    </div>
  );
}
