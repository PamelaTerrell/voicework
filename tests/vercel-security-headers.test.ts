import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(resolve("vercel.json"), "utf8"),
) as unknown;

describe("Vercel global browser security headers", () => {
  it("keeps the approved global headers and explicitly routes application pages", () => {
    expect(config).toEqual({
      headers: [
        {
          source: "/(.*)",
          headers: [
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "X-Frame-Options", value: "DENY" },
            {
              key: "Referrer-Policy",
              value: "strict-origin-when-cross-origin",
            },
            {
              key: "Permissions-Policy",
              value: "camera=(), microphone=(), geolocation=(), usb=()",
            },
          ],
        },
        {
          source: "/:path(members|thanks|contact-thanks|demos)",
          headers: [{ key: "X-Robots-Tag", value: "noindex" }],
        },
        {
          source: "/auth/callback",
          headers: [{ key: "X-Robots-Tag", value: "noindex" }],
        },
      ],
      rewrites: [
        { source: "/api/(.*)", destination: "/api/$1" },
        { source: "/:page(listen|voice|join|contact)", destination: "/:page.html" },
        { source: "/:path(members|thanks|contact-thanks|demos)", destination: "/" },
        { source: "/auth/callback", destination: "/" },
      ],
    });
  });

  it("does not introduce excluded response policies", () => {
    const serialized = JSON.stringify(config).toLowerCase();
    for (const excluded of [
      "content-security-policy",
      "strict-transport-security",
      "cache-control",
      "cross-origin-",
      "access-control-",
      "payment=",
    ]) {
      expect(serialized).not.toContain(excluded);
    }
  });
});
