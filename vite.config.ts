import path from "path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const publicPages = [
  {
    route: "listen",
    title: "Night Listener | Original Audio Stories",
    description: "Hear a free full episode and explore Night Listener, the original narrated storytelling series from Stabile USA.",
  },
  {
    route: "voice",
    title: "Voice &amp; Production",
    description: "Hear founding narrator Pamela J. Terrell and inquire about story, audiobook, documentary-style, and other voiceover projects.",
  },
  {
    route: "join",
    title: "Night Listener Membership",
    description: "Explore the full library of original Night Listener stories with a Stabile USA membership.",
  },
  {
    route: "contact",
    title: "Contact",
    description: "Contact Stabile USA about narration, production, creative collaborations, digital projects, or Night Listener support.",
  },
];

function routeMetadata(): Plugin {
  return {
    name: "stabile-route-metadata",
    apply: "build",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_, bundle) {
        const index = bundle["index.html"];
        if (index?.type !== "asset" || typeof index.source !== "string") {
          throw new Error("The Vite HTML template was not generated.");
        }

        for (const { route, title, description } of publicPages) {
          const url = `https://www.stabileusa.com/${route}`;
          const pageTitle = `${title} | Stabile USA`;
          const html = index.source
            .replace(/<title>[\s\S]*?<\/title>/, `<title>${pageTitle}</title>`)
            .replace(/(name="description"\s+content=")[^"]*/, `$1${description}`)
            .replace(/((?:property="og:title"|name="twitter:title")\s+content=")[^"]*/g, `$1${pageTitle}`)
            .replace(/((?:property="og:description"|name="twitter:description")\s+content=")[^"]*/g, `$1${description}`)
            .replace(/((?:rel="canonical"|property="og:url")\s+(?:href|content)=")[^"]*/g, `$1${url}`);

          this.emitFile({ type: "asset", fileName: `${route}.html`, source: html });
        }
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), routeMetadata()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
