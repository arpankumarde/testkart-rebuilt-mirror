import { classifyTrafficSource } from "./classifyTrafficSource";

/**
 * Server side of the measurement layer: reads the cookies that
 * helpers/installVisitorTracking writes (tk_vid, tk_touch) and the click
 * cookie set by endpoints/go_GET (tk_mid). The app sends no cookies; it is
 * told apart by its X-Client-Platform header and may send its own install id
 * as X-Client-Install-Id. Everything is shape-checked, since cookies are
 * client-controlled.
 */

export type VisitorTouch = {
  source: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerHost: string | null;
  at: Date;
};

export type VisitorContext = {
  visitorId: string | null;
  platform: "web" | "android" | "ios";
  firstTouch: VisitorTouch | null;
  lastTouch: VisitorTouch | null;
  messageId: string | null;
};

const DAY_SECONDS = 24 * 60 * 60;
const FIRST_TOUCH_MAX_DAYS = 90;
const LAST_TOUCH_MAX_DAYS = 30;

const VISITOR_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAG_RE = /^[a-z0-9_.-]{1,60}$/;
const HOST_RE = /^[a-z0-9.-]{1,80}$/;
const MESSAGE_RE = /^[1-9][0-9]{0,15}$/;

function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    try {
      cookies.set(name, decodeURIComponent(raw));
    } catch {
      cookies.set(name, raw);
    }
  }
  return cookies;
}

const tag = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toLowerCase();
  return TAG_RE.test(cleaned) ? cleaned : null;
};

function parseTouch(value: unknown, maxDays: number, nowSeconds: number): VisitorTouch | null {
  if (!value || typeof value !== "object") return null;
  const touch = value as Record<string, unknown>;
  const at = typeof touch.t === "number" && Number.isFinite(touch.t) ? touch.t : null;
  if (at === null || at > nowSeconds + 300 || nowSeconds - at > maxDays * DAY_SECONDS) return null;
  const utmSource = tag(touch.s);
  const host = typeof touch.r === "string" ? touch.r.trim().toLowerCase().replace(/^www\./, "") : "";
  const referrerHost = HOST_RE.test(host) ? host : null;
  return {
    source: classifyTrafficSource(utmSource, referrerHost),
    utmSource,
    utmMedium: tag(touch.m),
    utmCampaign: tag(touch.c),
    referrerHost,
    at: new Date(at * 1000),
  };
}

export function readVisitorContext(request: Request, now: Date = new Date()): VisitorContext {
  const headers = request.headers;
  const cookies = parseCookies(headers.get("cookie"));
  const platformHeader = headers.get("x-client-platform")?.trim().toLowerCase();
  const platform = platformHeader === "android" || platformHeader === "ios" ? platformHeader : "web";

  const installId = headers.get("x-client-install-id")?.trim() ?? "";
  const cookieVisitor = cookies.get("tk_vid") ?? "";
  const visitorId = VISITOR_RE.test(installId)
    ? installId.toLowerCase()
    : VISITOR_RE.test(cookieVisitor)
      ? cookieVisitor.toLowerCase()
      : null;

  const nowSeconds = Math.floor(now.getTime() / 1000);
  let firstTouch: VisitorTouch | null = null;
  let lastTouch: VisitorTouch | null = null;
  const rawTouch = cookies.get("tk_touch");
  if (rawTouch && rawTouch.length <= 1500) {
    try {
      const parsed = JSON.parse(rawTouch) as Record<string, unknown>;
      firstTouch = parseTouch(parsed?.f, FIRST_TOUCH_MAX_DAYS, nowSeconds);
      lastTouch = parseTouch(parsed?.l, LAST_TOUCH_MAX_DAYS, nowSeconds);
    } catch {
      // A broken cookie counts as no touch.
    }
  }

  const rawMessage = cookies.get("tk_mid") ?? "";
  const messageId = MESSAGE_RE.test(rawMessage) ? rawMessage : null;

  return { visitorId, platform, firstTouch, lastTouch, messageId };
}