import { getClientIp } from "./getClientIp";
import type { OrderClientDeviceType, OrderClientSource } from "./orderAttribution";

export type { OrderClientDeviceType, OrderClientSource } from "./orderAttribution";

/**
 * Who placed an order and from where, stored on the orders row at creation.
 *
 * The mobile app identifies itself with X-Client-Platform, X-Client-Device,
 * X-Client-OS, X-Client-OS-Version, X-Client-Brand, X-Client-Model,
 * X-Client-Screen and X-App-Version headers; builds that predate those headers
 * are recognised from the okhttp / CFNetwork User-Agent. Browsers are
 * classified from the User-Agent plus the tk_cctx cookie the website sets
 * (helpers/clientContextCookie), which carries what a reduced User-Agent no
 * longer does: the real Android version and model from User-Agent Client
 * Hints, screen size, touch support and the first-touch referrer.
 *
 * Everything here is self-reported by the client. Each value is shape-checked
 * and anything that does not fit is dropped rather than guessed, so use it for
 * analytics and fraud review, never for access decisions.
 */

export interface OrderClientInfo {
  clientSource: OrderClientSource;
  clientDeviceType: OrderClientDeviceType;
  /** Display label, for example "Chrome 156". */
  clientBrowser: string | null;
  /** Display label, for example "Android 14". */
  clientOs: string | null;
  clientAppVersion: string | null;
  clientUserAgent: string | null;
  clientIp: string | null;
  clientOsName: string | null;
  clientOsVersion: string | null;
  clientBrowserName: string | null;
  clientBrowserVersion: string | null;
  clientDeviceBrand: string | null;
  clientDeviceModel: string | null;
  clientScreen: string | null;
  clientReferrer: string | null;
}

export const CLIENT_CONTEXT_COOKIE = "tk_cctx";

const ANDROID_APP_PACKAGE = "com.testkart.mocktest.courses.studynotes";

const VERSION_RE = /^\d{1,4}(?:\.\d{1,6}){0,3}$/;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9 _\-.,+()/]{0,59}$/;
const BRAND_RE = /^[A-Za-z0-9][A-Za-z0-9 _\-.&]{0,39}$/;
const SCREEN_RE = /^\d{2,5}x\d{2,5}$/;
const REFERRER_RE = /^[a-z0-9][a-z0-9._\-]{0,79}$/i;

function clean(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const text = value.replace(/\p{Cc}/gu, " ").trim();
  return text ? text.slice(0, max) : null;
}

function matching(value: string | null | undefined, pattern: RegExp): string | null {
  const text = value?.trim();
  return text && pattern.test(text) ? text : null;
}

function major(version: string | null | undefined): string | null {
  const head = version?.split(".")[0];
  return head && /^\d+$/.test(head) ? head : null;
}

/** "14.0.0" to "14", "17.4.1" to "17.4": trailing zero parts carry no information. */
function trimVersion(version: string | null | undefined): string | null {
  if (!version || !VERSION_RE.test(version)) return null;
  const parts = version.split(".");
  while (parts.length > 1 && /^0+$/.test(parts[parts.length - 1])) parts.pop();
  return parts.slice(0, 2).join(".");
}

const BRAND_ALIASES: [RegExp, string][] = [
  [/^samsung$/i, "Samsung"],
  [/^(redmi|xiaomi|poco|mi)$/i, "Xiaomi"],
  [/^oneplus$/i, "OnePlus"],
  [/^(vivo|iqoo)$/i, "Vivo"],
  [/^oppo$/i, "Oppo"],
  [/^realme$/i, "Realme"],
  [/^(motorola|moto)$/i, "Motorola"],
  [/^google$/i, "Google"],
  [/^apple$/i, "Apple"],
  [/^(nokia|hmd( global)?)$/i, "Nokia"],
  [/^infinix$/i, "Infinix"],
  [/^tecno$/i, "Tecno"],
  [/^itel$/i, "itel"],
  [/^lava$/i, "Lava"],
  [/^nothing$/i, "Nothing"],
  [/^honor$/i, "Honor"],
  [/^huawei$/i, "Huawei"],
  [/^(lenovo)$/i, "Lenovo"],
  [/^(asus)$/i, "Asus"],
];

/** A brand the device itself reported, folded onto one spelling per manufacturer. */
export function normalizeBrand(brand: string | null | undefined): string | null {
  const value = matching(brand, BRAND_RE);
  if (!value) return null;
  for (const [pattern, name] of BRAND_ALIASES) {
    if (pattern.test(value)) return name;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/*
 * Only prefixes that belong to one manufacturer. CPH model numbers are shared
 * by Oppo, OnePlus and Realme, so they get no brand.
 */
const MODEL_BRANDS: [RegExp, string][] = [
  [/^SM-/i, "Samsung"],
  [/^Galaxy/i, "Samsung"],
  [/^Pixel/i, "Google"],
  [/^(Redmi|POCO|Mi |Xiaomi)/i, "Xiaomi"],
  [/^(ONEPLUS|OnePlus)/, "OnePlus"],
  [/^vivo/i, "Vivo"],
  [/^OPPO/i, "Oppo"],
  [/^RMX\d/i, "Realme"],
  [/^(moto|motorola)/i, "Motorola"],
  [/^Nokia/i, "Nokia"],
  [/^Infinix/i, "Infinix"],
  [/^TECNO/i, "Tecno"],
  [/^itel/i, "itel"],
  [/^LAVA/i, "Lava"],
];

export function brandFromModel(model: string | null | undefined): string | null {
  if (!model) return null;
  for (const [pattern, name] of MODEL_BRANDS) {
    if (pattern.test(model)) return name;
  }
  return null;
}

export interface ParsedUserAgent {
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  osVersion: string | null;
  deviceType: OrderClientDeviceType;
  deviceBrand: string | null;
  deviceModel: string | null;
  /** Chrome's reduced Android UA ("Android 10; K") hides the real version and model. */
  reducedAndroid: boolean;
  /** Safari 26+ freezes the iOS version in the UA, so it no longer says which iOS this is. */
  frozenIosVersion: boolean;
  chromium: boolean;
}

function parseBrowser(ua: string): { name: string | null; version: string | null; chromium: boolean } {
  const chromium = /(Chrome|CriOS|Chromium)\//.test(ua) && !/(CriOS|EdgiOS|OPiOS)\//.test(ua);
  if (!/^Mozilla\//.test(ua)) return { name: null, version: null, chromium: false };

  const inApp: [string, RegExp][] = [
    ["Facebook in-app", /FBAN|FBAV/],
    ["Instagram in-app", /Instagram/],
    ["LinkedIn in-app", /LinkedInApp/],
    ["Snapchat in-app", /Snapchat/],
    ["Telegram in-app", /Telegram/],
    ["Google app", /GSA\//],
  ];
  for (const [name, pattern] of inApp) {
    if (pattern.test(ua)) return { name, version: null, chromium };
  }

  const browsers: [string, RegExp][] = [
    ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
    ["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ["Opera", /(?:OPR|OPT|OPiOS)\/([\d.]+)/],
    ["UC Browser", /UCBrowser\/([\d.]+)/],
    ["Yandex", /YaBrowser\/([\d.]+)/],
    ["Mi Browser", /MiuiBrowser\/([\d.]+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
  ];
  for (const [name, pattern] of browsers) {
    const match = ua.match(pattern);
    if (match) return { name, version: major(match[1]), chromium };
  }

  if (/; wv\)/.test(ua)) return { name: "Android WebView", version: null, chromium };

  const chrome = ua.match(/(?:CriOS|Chrome)\/([\d.]+)/);
  if (chrome) return { name: "Chrome", version: major(chrome[1]), chromium };

  const safari = ua.match(/Version\/([\d.]+).*Safari\//);
  if (safari) return { name: "Safari", version: major(safari[1]), chromium };

  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return { name: "iOS WebView", version: null, chromium };
  return { name: null, version: null, chromium };
}

export function parseUserAgent(ua: string): ParsedUserAgent {
  const browser = parseBrowser(ua);
  const result: ParsedUserAgent = {
    browserName: browser.name,
    browserVersion: browser.version,
    osName: null,
    osVersion: null,
    deviceType: "unknown",
    deviceBrand: null,
    deviceModel: null,
    reducedAndroid: false,
    frozenIosVersion: false,
    chromium: browser.chromium,
  };

  const android = ua.match(/Android ([\d.]+)?/);
  const ios = ua.match(/(iPhone|iPad|iPod).*? OS (\d+(?:_\d+)*)/);

  if (android) {
    result.osName = "Android";
    result.reducedAndroid = /Android 10; K\)/.test(ua);
    if (!result.reducedAndroid) {
      result.osVersion = trimVersion(android[1]);
      const model = ua.match(/Android [\d.]+;(?: [a-z]{2}[-_][A-Za-z]{2};)? ([^;)]+?)(?: Build\/[^;)]*)?[;)]/);
      const candidate = matching(model?.[1], MODEL_RE);
      if (candidate && candidate !== "K" && !/^(Linux|U|wv|Mobile)$/i.test(candidate)) {
        result.deviceModel = candidate;
        result.deviceBrand = brandFromModel(candidate);
      }
    }
  } else if (ios) {
    result.osName = ios[1] === "iPad" ? "iPadOS" : "iOS";
    result.deviceBrand = "Apple";
    result.deviceModel = ios[1] === "iPod" ? "iPod touch" : ios[1];
    const reported = ios[2].replace(/_/g, ".");
    const safariMajor = Number(major(ua.match(/Version\/([\d.]+)/)?.[1]) ?? 0);
    result.frozenIosVersion = safariMajor >= 26 && Number(major(reported)) < 26;
    result.osVersion = result.frozenIosVersion ? null : trimVersion(reported);
  } else if (/CFNetwork\/.*Darwin\//.test(ua)) {
    result.osName = "iOS";
  } else if (/Windows NT/.test(ua)) {
    result.osName = "Windows";
  } else if (/CrOS/.test(ua)) {
    result.osName = "ChromeOS";
  } else if (/Mac OS X|Macintosh/.test(ua)) {
    result.osName = "macOS";
    result.deviceBrand = "Apple";
    result.deviceModel = "Mac";
  } else if (/Linux/.test(ua)) {
    result.osName = "Linux";
  }

  if (/iPad|Tablet|Kindle|Silk\/|PlayBook/.test(ua)) result.deviceType = "tablet";
  else if (/Android/.test(ua) && !/Mobile/.test(ua)) result.deviceType = "tablet";
  else if (/Mobi|iPhone|iPod|Android/.test(ua)) result.deviceType = "mobile";
  else if (/Windows NT|Macintosh|CrOS|X11|Linux x86_64/.test(ua)) result.deviceType = "desktop";

  return result;
}

/**
 * The X-Client-OS header from the app: "Android 16", "iOS 18.1", or on some
 * Android builds the raw build fingerprint
 * (BRAND/PRODUCT/DEVICE:RELEASE/ID/INCREMENTAL:TYPE/TAGS).
 */
export function parseAppOs(
  value: string | null | undefined,
  platform: "android" | "ios"
): { osName: string; osVersion: string | null; brand: string | null } {
  const osName = platform === "android" ? "Android" : "iOS";
  const text = value?.trim() ?? "";
  const fingerprint = text.match(/^([^/\s]+)\/[^/]+\/[^/:]+:(\d+(?:\.\d+)*)\//);
  if (fingerprint) {
    return { osName, osVersion: trimVersion(fingerprint[2]), brand: normalizeBrand(fingerprint[1]) };
  }
  const named = text.match(/^(?:Android|iOS|iPadOS|iPhone OS)\s+(\d+(?:\.\d+)*)$/i);
  if (named) {
    const name = /^iPadOS/i.test(text) ? "iPadOS" : osName;
    return { osName: name, osVersion: trimVersion(named[1]), brand: null };
  }
  return { osName, osVersion: null, brand: null };
}

type ClientContext = {
  screen: string | null;
  model: string | null;
  platformVersion: string | null;
  touchPoints: number;
  referrer: string | null;
};

function readClientContext(cookieHeader: string | null): ClientContext {
  const empty: ClientContext = { screen: null, model: null, platformVersion: null, touchPoints: 0, referrer: null };
  if (!cookieHeader) return empty;
  const raw = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CLIENT_CONTEXT_COOKIE}=`));
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(CLIENT_CONTEXT_COOKIE.length + 1)));
    if (!parsed || typeof parsed !== "object") return empty;
    const touch = Number(parsed.tp);
    return {
      screen: typeof parsed.s === "string" ? matching(parsed.s, SCREEN_RE) : null,
      model: typeof parsed.m === "string" ? matching(parsed.m, MODEL_RE) : null,
      platformVersion: typeof parsed.pv === "string" ? matching(parsed.pv, VERSION_RE) : null,
      touchPoints: Number.isInteger(touch) && touch >= 0 && touch <= 20 ? touch : 0,
      referrer: typeof parsed.r === "string" ? matching(parsed.r, REFERRER_RE)?.toLowerCase() ?? null : null,
    };
  } catch {
    return empty;
  }
}

function deviceFromAppHeader(value: string | null): OrderClientDeviceType {
  switch (value?.toLowerCase()) {
    case "phone":
      return "mobile";
    case "tablet":
      return "tablet";
    case "desktop":
      return "desktop";
    default:
      return "unknown";
  }
}

function label(name: string | null, version: string | null): string | null {
  if (!name) return null;
  return version ? `${name} ${version}` : name;
}

export function getOrderClientInfo(request: Request): OrderClientInfo {
  const headers = request.headers;
  const userAgent = clean(headers.get("user-agent"), 1000);
  const ua = userAgent ?? "";
  const parsed = parseUserAgent(ua);
  const platformHeader = headers.get("x-client-platform")?.trim().toLowerCase();
  const requestedWith = headers.get("x-requested-with")?.trim();

  // A full browser User-Agent wins over an app platform header: the app's own
  // requests go out through okhttp, CFNetwork or an in-app WebView.
  const browserUa = /^Mozilla\//.test(ua) && /Safari\//.test(ua) && !/; wv\)/.test(ua);

  let clientSource: OrderClientSource = "unknown";
  if (platformHeader === "android" && !browserUa) clientSource = "android_app";
  else if (platformHeader === "ios" && !browserUa) clientSource = "ios_app";
  else if (requestedWith === ANDROID_APP_PACKAGE) clientSource = "android_app";
  else if (/^okhttp\//i.test(ua)) clientSource = "android_app";
  else if (/CFNetwork\//.test(ua) && !/^Mozilla\//.test(ua)) clientSource = "ios_app";
  else if (/^Mozilla\//.test(ua)) clientSource = "web";

  const isApp = clientSource === "android_app" || clientSource === "ios_app";

  let osName = parsed.osName;
  let osVersion = parsed.osVersion;
  let deviceType = parsed.deviceType;
  let deviceBrand = parsed.deviceBrand;
  let deviceModel = parsed.deviceModel;
  let browserName = parsed.browserName;
  let browserVersion = parsed.browserVersion;
  let screen: string | null = null;
  let referrer: string | null = null;

  if (isApp) {
    const platform = clientSource === "android_app" ? "android" : "ios";
    const appOs = parseAppOs(headers.get("x-client-os"), platform);
    osName = appOs.osName;
    osVersion = trimVersion(matching(headers.get("x-client-os-version"), VERSION_RE)) ?? appOs.osVersion;
    const appDevice = deviceFromAppHeader(headers.get("x-client-device"));
    deviceType = appDevice !== "unknown" ? appDevice : parsed.deviceType;
    deviceModel = matching(headers.get("x-client-model"), MODEL_RE);
    deviceBrand =
      normalizeBrand(headers.get("x-client-brand")) ??
      appOs.brand ??
      brandFromModel(deviceModel) ??
      (platform === "ios" ? "Apple" : null);
    screen = matching(headers.get("x-client-screen"), SCREEN_RE);
    // The app's HTTP client is not a browser.
    browserName = requestedWith === ANDROID_APP_PACKAGE ? parsed.browserName : null;
    browserVersion = requestedWith === ANDROID_APP_PACKAGE ? parsed.browserVersion : null;
  } else if (clientSource === "web") {
    const context = readClientContext(headers.get("cookie"));
    screen = context.screen;
    referrer = context.referrer;

    // Client Hints are Chromium-only; a model or version from anywhere else is ignored.
    if (parsed.chromium && osName === "Android") {
      if (context.platformVersion) osVersion = trimVersion(context.platformVersion);
      if (context.model && !deviceModel) {
        deviceModel = context.model;
        deviceBrand = brandFromModel(context.model);
      }
    } else if (parsed.chromium && osName === "Windows" && context.platformVersion) {
      const windowsMajor = Number(major(context.platformVersion));
      if (windowsMajor >= 13) osVersion = "11";
      else if (windowsMajor > 0) osVersion = "10";
    } else if (parsed.chromium && osName === "macOS" && context.platformVersion) {
      osVersion = trimVersion(context.platformVersion);
    }

    // iPadOS Safari asks for the desktop site and sends a Mac User-Agent; only touch tells them apart.
    if (osName === "macOS" && context.touchPoints > 1 && browserName === "Safari") {
      osName = "iPadOS";
      osVersion = null;
      deviceType = "tablet";
      deviceBrand = "Apple";
      deviceModel = "iPad";
    }
  }

  return {
    clientSource,
    clientDeviceType: deviceType,
    clientBrowser: clean(label(browserName, browserVersion), 60),
    clientOs: clean(label(osName, osVersion), 60),
    clientAppVersion: isApp ? clean(headers.get("x-app-version"), 40) : null,
    clientUserAgent: userAgent,
    clientIp: clean(getClientIp(request), 64),
    clientOsName: osName,
    clientOsVersion: osVersion,
    clientBrowserName: browserName,
    clientBrowserVersion: browserVersion,
    clientDeviceBrand: deviceBrand,
    clientDeviceModel: deviceModel,
    clientScreen: screen,
    clientReferrer: referrer,
  };
}
