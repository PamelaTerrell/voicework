
import React from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
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

// The Human Experience
import QuestionOfTheWeek from "@/pages/QuestionOfTheWeek";

const router = createBrowserRouter([
  {
    path: "/",
    element: <SiteLayout />,
    children: [
      { index: true, element: <Home /> },

      // The Human Experience
      {
        path: "question",
        element: <QuestionOfTheWeek />,
      },

      // Night Listener
      { path: "listen", element: <Listen /> },
      { path: "join", element: <Join /> },
      { path: "demos", element: <Listen /> },
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
