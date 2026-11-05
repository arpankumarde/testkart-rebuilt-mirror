import { getSessionId } from "./getSessionId";

/**
 * Browser side of the autopilot's measurement layer. tk_vid mirrors the
 * browser's lasting visitor id (getSessionId, also stored on storefront events)
 * so server endpoints can read it. tk_touch keeps the first touch (90 days)
 * and the last tagged or external touch (30 days), so a buyer who returns
 * days later is still credited to where they first came from. Both hold only
 * a random id and source labels. The server reads them in
 * helpers/readVisitorContext.
 */

const VISITOR_COOKIE = "tk_vid";
const TOUCH_KEY = "tk_touch";
const YEAR_SECONDS = 60 * 60 * 24 * 365;
const TOUCH_SECONDS = 60 * 60 * 24 * 90;
const OWN_HOSTS = /(^|\.)(testkart\.in|floot\.app|floot\.com)$/;

type Touch = { s?: string; m?: string; c?: string; r?: string; t: number };
type Touches = { f?: Touch; l?: Touch };

const clip = (value: string | null): string | undefined => {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed.slice(0, 60) : undefined;
};

function setCookie(name: string, value: string, maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function landingTouch(): Touch {
  const params = new URLSearchParams(window.location.search);
  let referrer: string | undefined;
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, "");
      if (host && !OWN_HOSTS.test(host) && host !== window.location.hostname.replace(/^www\./, "")) referrer = host;
    }
  } catch {
    referrer = undefined;
  }
  let source = clip(params.get("utm_source"));
  let medium = clip(params.get("utm_medium"));
  if (!source && params.get("gclid")) {
    source = "google";
    medium = medium ?? "cpc";
  }
  return {
    s: source,
    m: medium,
    c: clip(params.get("utm_campaign")),
    r: referrer,
    t: Math.floor(Date.now() / 1000),
  };
}

function readStored(): Touches {
  try {
    const raw = window.localStorage.getItem(TOUCH_KEY);
    const parsed = raw ? (JSON.parse(raw) as Touches) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

let installed = false;

export function installVisitorTracking() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;
  try {
    const visitorId = getSessionId();
    if (!visitorId.startsWith("temp-")) setCookie(VISITOR_COOKIE, visitorId, YEAR_SECONDS);

    const now = landingTouch();
    const stored = readStored();
    const next: Touches = { ...stored };
    if (!stored.f || typeof stored.f.t !== "number" || now.t - stored.f.t > TOUCH_SECONDS) next.f = now;
    if (now.s || now.r) next.l = now;

    const value = JSON.stringify(next);
    try {
      window.localStorage.setItem(TOUCH_KEY, value);
    } catch {
      // The cookie still carries it for this browser.
    }
    setCookie(TOUCH_KEY, value, TOUCH_SECONDS);
  } catch {
    // Attribution is best effort; the site works without it.
  }
}