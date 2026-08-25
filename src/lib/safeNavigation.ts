const DEFAULT_AUTH_DESTINATION = "/members";

const APPROVED_AUTH_DESTINATIONS = new Set([DEFAULT_AUTH_DESTINATION]);

const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "code",
  "refresh_token",
  "session_id",
  "token",
  "token_hash",
]);

export function resolveAuthDestination(
  values: string[] | string | null | undefined,
): string {
  const value = Array.isArray(values)
    ? values.length === 1
      ? values[0]
      : null
    : values;

  if (typeof value !== "string") return DEFAULT_AUTH_DESTINATION;
  if (!APPROVED_AUTH_DESTINATIONS.has(value)) return DEFAULT_AUTH_DESTINATION;
  return value;
}

export function sanitizedPathname(value: string, fallback = "/"): string {
  try {
    const url = new URL(value, "https://stabileusa.invalid");
    return url.pathname.startsWith("/") ? url.pathname : fallback;
  } catch {
    return fallback;
  }
}

export function removeSensitiveUrlParameters(value: string): string {
  const url = new URL(value, "https://stabileusa.invalid");

  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }

  url.hash = "";
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

export function clearSensitiveBrowserUrl(): void {
  const safeUrl = sanitizedPathname(window.location.href);
  window.history.replaceState(window.history.state, "", safeUrl);
}
