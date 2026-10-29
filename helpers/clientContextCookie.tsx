import { readAttribution } from "./trackStorefrontEvent";

/**
 * Writes the tk_cctx cookie that helpers/orderClientInfo reads when an order is
 * created from the website. It carries what the User-Agent alone cannot say
 * reliably: screen size, touch support (iPadOS Safari sends a Mac User-Agent),
 * the device model and real OS version from User-Agent Client Hints (Chromium
 * freezes Android at "10; K"), and the visit's first-touch source.
 *
 * A cookie rather than request headers so every checkout path picks it up,
 * including the PayU redirects the browser navigates to directly. It holds no
 * personal data and is shape-checked again on the server.
 */

const COOKIE = "tk_cctx";
const MAX_AGE_SECONDS = 60 * 60 * 24;

type ClientContext = {
  s?: string;
  tp?: number;
  m?: string;
  pv?: string;
  r?: string;
};

type HighEntropyNavigator = Navigator & {
  userAgentData?: {
    getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string; platformVersion?: string }>;
  };
};

function write(context: ClientContext) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(context))}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function sourceLabel(): string | undefined {
  const { utmSource, referrerHost } = readAttribution();
  const utm = utmSource?.trim().toLowerCase();
  if (utm && /^[a-z0-9][a-z0-9._-]{0,79}$/.test(utm)) return utm;
  const host = referrerHost?.trim().toLowerCase().replace(/^www\./, "");
  if (!host || host === window.location.hostname.replace(/^www\./, "") || /(^|\.)testkart\.in$/.test(host)) {
    return undefined;
  }
  return /^[a-z0-9][a-z0-9.-]{0,79}$/.test(host) ? host : undefined;
}

let installed = false;

export function installClientContextCookie() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;
  try {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round((window.screen?.width ?? 0) * dpr);
    const height = Math.round((window.screen?.height ?? 0) * dpr);
    const context: ClientContext = {
      s: width > 0 && height > 0 ? `${width}x${height}` : undefined,
      tp: navigator.maxTouchPoints || 0,
      r: sourceLabel(),
    };
    write(context);

    const uaData = (navigator as HighEntropyNavigator).userAgentData;
    uaData
      ?.getHighEntropyValues?.(["model", "platformVersion"])
      .then((values) => {
        const model = values.model?.trim();
        write({
          ...context,
          m: model ? model.slice(0, 60) : undefined,
          pv: values.platformVersion?.trim().slice(0, 20) || undefined,
        });
      })
      .catch(() => undefined);
  } catch {
    // Attribution is best effort; checkout works without it.
  }
}
