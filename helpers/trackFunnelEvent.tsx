import { postAnalyticsEvent, type ClientFunnelEvent } from "../endpoints/analytics/event_POST.schema";
import type { StorefrontEntity } from "../endpoints/analytics/track_POST.schema";

/**
 * Sends one browser-only funnel event (helpers/recordFunnelEvent has the full
 * list). Fire-and-forget: tracking never gets in the way of the page. The
 * visitor id and source travel in the tk_vid and tk_touch cookies.
 */
export function trackFunnelEvent(
  event: ClientFunnelEvent,
  target?: { entity: StorefrontEntity; id?: number | null },
  props?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined" || navigator.webdriver) return;
  try {
    void postAnalyticsEvent({
      event,
      entityType: target?.entity,
      entityId: target?.id && target.id > 0 ? target.id : undefined,
      path: window.location.pathname.slice(0, 200),
      props,
    }).catch(() => undefined);
  } catch {
    // A missed event is better than a broken page.
  }
}