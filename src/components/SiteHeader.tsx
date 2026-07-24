import { Link, useLocation } from "react-router-dom";
import { Auth } from "@/components/Auth";
import { Button } from "@/components/ui/button";

function NavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const active = location.pathname === to;

  return (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex min-w-0 items-center gap-8">
          <Link to="/" className="min-w-0">
            <div className="flex min-w-0 flex-col leading-tight">
              <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight text-foreground">
                  Night Listener
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  by Stabile USA
                </span>
              </div>

              <div className="text-sm text-muted-foreground">
                Story-driven reflections on human behavior
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <NavLink to="/" label="Home" />
            <NavLink to="/listen" label="Listen" />
            <NavLink to="/classic-readings" label="Classic Readings" />

            <a
              href="/#submit-story"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Submit a Story
            </a>

            <NavLink to="/join" label="Join" />
            <NavLink to="/contact" label="Contact" />
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <a href="/#submit-story">Submit a Story</a>
          </Button>

          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link to="/listen">Play a preview</Link>
          </Button>

          <Button asChild className="hidden sm:inline-flex">
            <Link to="/join">Unlock Membership</Link>
          </Button>

          <div className="hidden lg:block">
            <Auth />
          </div>
        </div>
      </div>

      <div className="border-t px-6 py-3 lg:hidden">
        <div className="mx-auto max-w-7xl space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href="/#submit-story"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Submit a Story
            </a>

            <Link
              to="/listen"
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              Listen
            </Link>

            <Link
              to="/classic-readings"
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              Classic Readings
            </Link>

            <Link
              to="/join"
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              Join
            </Link>

            <Link
              to="/contact"
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              Contact
            </Link>
          </div>

          <Auth />
        </div>
      </div>
    </header>
  );
}