
import React from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Navigate,
} from "react-router-dom";

import "./index.css";

import SiteLayout from "@/components/layout/SiteLayout";

import Home from "@/pages/Home";
import Listen from "@/pages/Listen";
import Join from "@/pages/Join";
import Contact from "@/pages/Contact";
import ContactThanks from "@/pages/ContactThanks";
import Thanks from "@/pages/Thanks";
import Members from "@/pages/Members";
import AuthCallback from "@/pages/AuthCallback";

import Voice from "@/pages/Voice";

const router = createBrowserRouter([
  {
    path: "/",
    element: <SiteLayout />,
    children: [
      { index: true, element: <Home /> },

      // Night Listener
      { path: "listen", element: <Listen /> },
      { path: "join", element: <Join /> },
      { path: "voice", element: <Voice /> },
      { path: "demos", element: <Navigate to="/voice" replace /> },
      { path: "members", element: <Members /> },

      // Contact
      { path: "contact", element: <Contact /> },
      {
        path: "contact-thanks",
        element: <ContactThanks />,
      },

      // Checkout and authentication
      { path: "thanks", element: <Thanks /> },
      {
        path: "auth/callback",
        element: <AuthCallback />,
      },
      {
        path: "*",
        element: (
          <section className="mx-auto max-w-4xl px-5 py-20">
            <h1 className="text-4xl font-semibold">Page not found</h1>
            <Link className="mt-5 inline-block underline" to="/">Return to Stabile USA</Link>
          </section>
        ),
      },
    ],
  },
]);

ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
