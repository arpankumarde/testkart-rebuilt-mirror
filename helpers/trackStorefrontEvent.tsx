import { useEffect } from "react";
import { getSessionId } from "./getSessionId";
import {
  postStorefrontEvent,
  StorefrontEntity,
  StorefrontEvent,
} from "../endpoints/analytics/track_POST.schema";
import type { ShareAssetKind, SharePlatformId } from "./shareLinks";

const ATTRIBUTION_KEY = "tk_first_touch";

type Attribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerHost: string | null;
};

/**
 * The tab's first-touch source: the UTM tags and referrer of the page the
 * visitor landed on, kept in sessionStorage so moving around the site does
 * not turn a WhatsApp visit into an internal one.
 */
function readAttribution(): Attribution {
  try {
    const stored = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    if (stored) return JSON.parse(stored) as Attribution;
  } catch {
    // Storage blocked: fall through and read the current page.
  }
  const params = new URLSearchParams(window.location.search);
  let referrerHost: string | null = null;
  try {
    if (document.referrer) referrerHost = new URL(document.referrer).hostname;
  } catch {
    referrerHost = null;
  }
  const attribution: Attribution = {
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    referrerHost,
  };
  try {
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // Not remembered; the next page reads its own URL again.
  }
  return attribution;
}

function readDevice(): "mobile" | "tablet" | "desktop" {
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  if (!coarse) return "desktop";
  const shortSide = Math.min(window.screen?.width ?? 0, window.screen?.height ?? 0);
  return shortSide >= 600 ? "tablet" : "mobile";
}

type TrackTarget = { entity: StorefrontEntity; id?: number; slug?: string };

/** Fire-and-forget; analytics never gets in the way of the page. */
export function trackStorefrontEvent(
  event: StorefrontEvent,
  target: TrackTarget,
  share?: { platform: SharePlatformId; campaign: string }
): void {
  if (typeof window === "undefined" || navigator.webdriver) return;
  try {
    const attribution = readAttribution();
    void postStorefrontEvent({
      event,
      entity: target.entity,
      id: target.id,
      slug: target.slug,
      sessionId: getSessionId(),
      ...attribution,
      device: readDevice(),
      platform: share?.platform,
      campaign: share?.campaign,
    }).catch(() => undefined);
  } catch {
    // Ignore: a missed event is better than a broken page.
  }
}

/** Records one view once the page knows which item it shows. Pass null while loading. */
export function useTrackStorefrontView(entity: StorefrontEntity, key: number | string | null | undefined) {
  useEffect(() => {
    if (key === null || key === undefined || key === "") return;
    trackStorefrontEvent("view", typeof key === "number" ? { entity, id: key } : { entity, slug: key });
  }, [entity, key]);
}

const SHARE_ENTITIES: Partial<Record<ShareAssetKind, StorefrontEntity>> = {
  "test-series": "mock_test",
  "live-test": "live_test",
  course: "course",
  bundle: "bundle",
  "study-note": "digital_product",
  expert: "teacher_profile",
};

/** A share button press on something a teacher sells or their profile; other kinds are ignored. */
export function trackShare(kind: ShareAssetKind, handle: string | number, platform: SharePlatformId, campaign: string) {
  const entity = SHARE_ENTITIES[kind];
  if (!entity) return;
  const numeric = typeof handle === "number" ? handle : /^\d+$/.test(handle) && kind === "live-test" ? Number(handle) : null;
  trackStorefrontEvent(
    "share",
    numeric !== null ? { entity, id: numeric } : { entity, slug: String(handle) },
    { platform, campaign }
  );
}