import { Link, NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";


function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "text-sm transition-colors",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

export default function SiteLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold tracking-tight">
            stabileusa.com
          </Link>

          <nav className="hidden items-center gap-6 sm:flex">
            <NavItem to="/" label="Home" />
            <NavItem to="/demos" label="Demos" />
            <NavItem to="/contact" label="Contact" />
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <a href="/demos">Hear a demo</a>
            </Button>
            <Button asChild>
              <a href="/contact">Contact</a>
            </Button>
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
  Portfolio:{" "}
  <a
    href="https://pamelajterrell.com"
    target="_blank"
    rel="noreferrer"
    className="underline underline-offset-4 hover:text-foreground"
  >
    pamelajterrell.com
  </a>
</p>

            <p>
              <a
  className="hover:text-foreground"
  href="mailto:agentpamelajterrell@gmail.com"
>
  agentpamelajterrell@gmail.com
</a>

            </p>
          </div>
        </div>
      </footer>
      <Analytics />
<SpeedInsights />

    </div>
  );
}
