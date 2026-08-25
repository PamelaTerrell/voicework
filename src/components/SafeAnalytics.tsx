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
    window.gtag?.("config", "G-FBR1LBB567", {
      page_path: pathname,
      page_location: pathname,
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
