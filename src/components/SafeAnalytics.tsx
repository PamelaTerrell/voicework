import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { sanitizedPathname } from "@/lib/safeNavigation";

function sanitizeAnalyticsEvent<T extends BeforeSendEvent>(event: T): T {
  return { ...event, url: sanitizedPathname(event.url) };
}

export function SafeAnalytics() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (["/auth/callback", "/thanks", "/contact-thanks"].includes(pathname)) return;

    window.gtag?.("event", "page_view", {
      page_path: pathname,
      page_location: new URL(pathname, window.location.origin).href,
    });
  }, [pathname]);

  return (
    <>
      <Analytics beforeSend={sanitizeAnalyticsEvent} />
      <SpeedInsights
        beforeSend={(event) => ({
          ...event,
          url: sanitizedPathname(event.url),
        })}
      />
    </>
  );
}
