import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";

import Home from "@/pages/Home";
import Listen from "@/pages/Listen";
import Members from "@/pages/Members";
import Join from "@/pages/Join";
import Contact from "@/pages/Contact";
import Thanks from "@/pages/Thanks";
import Demos from "@/pages/Demos";

import AuthCallback from "@/pages/AuthCallback";

import { Auth } from "@/components/Auth";


// Track page views for GA
function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    if (window.gtag) {
      window.gtag("config", "G-FBR1LBB567", {
        page_path: location.pathname,
      });
    }
  }, [location]);

  return null;
}

export default function App() {
  return (
    <Router>
      <AnalyticsTracker />

      <div className="min-h-screen bg-background text-foreground">

        {/* Header */}
        <header className="border-b">
          <div className="container mx-auto flex items-center justify-between p-4">
            <div className="font-semibold">stabileusa</div>
            <Auth />
          </div>
        </header>

        {/* Main */}
        <main className="container mx-auto p-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/listen" element={<Listen />} />
            <Route path="/members" element={<Members />} />
            <Route path="/join" element={<Join />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/thanks" element={<Thanks />} />
            <Route path="/demos" element={<Demos />} />

            {/* REQUIRED for magic link login */}
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Routes>
        </main>

      </div>
    </Router>
  );
}
