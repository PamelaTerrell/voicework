import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(resolve("vercel.json"), "utf8"),
) as unknown;

describe("Vercel global browser security headers", () => {
  it("contains only the approved global headers and unchanged rewrites", () => {
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
      ],
      rewrites: [
        { source: "/api/(.*)", destination: "/api/$1" },
        { source: "/(.*)", destination: "/" },
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
