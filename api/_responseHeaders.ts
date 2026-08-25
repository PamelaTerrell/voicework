import type { VercelResponse } from "@vercel/node";

function appendVary(res: VercelResponse, value: string) {
  const existing = res.getHeader("Vary");
  const values = (Array.isArray(existing) ? existing : [existing])
    .flatMap((entry) => String(entry ?? "").split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (
    !values.some(
      (entry) => entry === "*" || entry.toLowerCase() === value.toLowerCase(),
    )
  ) {
    values.push(value);
  }

  if (values.length > 0) res.setHeader("Vary", values.join(", "));
}

export function setApiResponseHeaders(
  res: VercelResponse,
  options: { varyAuthorization?: boolean } = {},
) {
  res.setHeader("Cache-Control", "no-store");
  if (options.varyAuthorization) appendVary(res, "Authorization");
}
