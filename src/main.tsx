import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";

import SiteLayout from "@/components/layout/SiteLayout";
import Home from "@/pages/Home";
import Listen from "@/pages/Listen";
import Join from "@/pages/Join";
import Contact from "@/pages/Contact";
import Thanks from "@/pages/Thanks";

import Members from "./pages/Members";


const router = createBrowserRouter([
  {
    path: "/",
    element: <SiteLayout />,
    children: [
      { index: true, element: <Home /> },

      // New structure
      { path: "listen", element: <Listen /> },
      { path: "join", element: <Join /> },

      // Keep old route working (optional but recommended)
      { path: "demos", element: <Listen /> },

      { path: "contact", element: <Contact /> },
      { path: "thanks", element: <Thanks /> },
      
      { path: "members", element: <Members />},
      

    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
