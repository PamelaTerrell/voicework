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
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="leading-tight">
            <div className="font-semibold tracking-tight">Stabile USA</div>
            <div className="hidden text-xs text-muted-foreground sm:block">
              Cozy late-night stories about human behavior
            </div>
          </Link>

          <nav className="hidden items-center gap-6 sm:flex">
            <NavItem to="/" label="Home" />
            <NavItem to="/listen" label="Listen" />
            <NavItem to="/join" label="Join" />
            <NavItem to="/contact" label="Contact" />
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link to="/listen">Play a preview</Link>
            </Button>
            <Button asChild>
              <Link to="/join">Join the Night List</Link>
            </Button>
          </div>
        </div>

        <div className="border-t">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between sm:hidden">
              <div className="flex items-center gap-4">
                <NavItem to="/listen" label="Listen" />
                <NavItem to="/join" label="Join" />
                <NavItem to="/contact" label="Contact" />
              </div>

              <div className="flex items-center gap-2">
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

      <main className="mx-auto max-w-5xl px-4 py-10">
        <Outlet />
      </main>

      <footer className="mt-10">
        <Separator />
        <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Created by{" "}
              <a
                href="https://pamelajterrell.com"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Pamela J. Terrell
              </a>
              <span className="ml-2 text-muted-foreground/70">
                (BA Sociology)
              </span>
            </p>

            <p className="flex gap-4">
              <a
                className="hover:text-foreground underline underline-offset-4"
                href="mailto:agentpamelajterrell@gmail.com"
              >
                Email
              </a>
              <Link
                className="hover:text-foreground underline underline-offset-4"
                to="/contact"
              >
                Contact
              </Link>
            </p>
          </div>
        </div>
      </footer>

      <Analytics />
      <SpeedInsights />
    </div>
  );
}