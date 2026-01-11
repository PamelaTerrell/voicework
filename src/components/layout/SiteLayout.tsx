import { Link, Outlet } from "react-router-dom";

export default function SiteLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">
            stabileusa.com
          </Link>
          <nav className="flex gap-6 text-sm">
            <Link to="/demos" className="hover:underline">Demos</Link>
            <Link to="/contact" className="hover:underline">Contact</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}
