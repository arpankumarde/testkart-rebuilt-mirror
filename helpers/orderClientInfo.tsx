import { getClientIp } from "./getClientIp";

/**
 * Who placed an order and from where, stored on the orders row at creation.
 * The mobile app identifies itself with X-Client-Platform, X-Client-Device,
 * X-Client-OS and X-App-Version headers; builds that predate those headers and
 * web browsers are recognised from the User-Agent instead. All of it is
 * self-reported by the client, so use it for analytics and fraud review, never
 * for access decisions.
 */

export type OrderClientSource = "web" | "android_app" | "ios_app" | "unknown";
export type OrderClientDeviceType = "mobile" | "tablet" | "desktop" | "unknown";

export interface OrderClientInfo {
  clientSource: OrderClientSource;
  clientDeviceType: OrderClientDeviceType;
  clientBrowser: string | null;
  clientOs: string | null;
  clientAppVersion: string | null;
  clientUserAgent: string | null;
  clientIp: string | null;
}

const ANDROID_APP_PACKAGE = "com.testkart.mocktest.courses.studynotes";

function clean(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const text = value.replace(/\p{Cc}/gu, " ").trim();
  return text ? text.slice(0, max) : null;
}

function majorVersion(version: string | undefined): string {
  return version ? ` ${version.split(".")[0]}` : "";
}

function detectBrowser(ua: string): string | null {
  if (!/^Mozilla\//.test(ua)) return null;

  const inApp: [string, RegExp][] = [
    ["Facebook in-app", /FBAN|FBAV/],
    ["Instagram in-app", /Instagram/],
    ["LinkedIn in-app", /LinkedInApp/],
    ["Snapchat in-app", /Snapchat/],
    ["Telegram in-app", /Telegram/],
  ];
  for (const [name, pattern] of inApp) {
    if (pattern.test(ua)) return name;
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
    if (match) return `${name}${majorVersion(match[1])}`;
  }

  if (/; wv\)/.test(ua)) return "Android WebView";

  const chrome = ua.match(/(?:CriOS|Chrome)\/([\d.]+)/);
  if (chrome) return `Chrome${majorVersion(chrome[1])}`;

  const safari = ua.match(/Version\/([\d.]+).*Safari\//);
  if (safari) return `Safari${majorVersion(safari[1])}`;

  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return "iOS WebView";
  return null;
}

function detectOs(ua: string): string | null {
  const android = ua.match(/Android ([\d.]+)/);
  if (android) return `Android ${android[1]}`;
  if (/Android/.test(ua)) return "Android";

  const ios = ua.match(/(iPhone|iPad|iPod).*? OS (\d+(?:_\d+)*)/);
  if (ios) return `${ios[1] === "iPad" ? "iPadOS" : "iOS"} ${ios[2].replace(/_/g, ".")}`;
  if (/CFNetwork\/.*Darwin\//.test(ua)) return "iOS";

  if (/Windows NT/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

function detectDeviceFromUa(ua: string, mobileHint: string | null): OrderClientDeviceType {
  if (/iPad|Tablet|Kindle|Silk\/|PlayBook/.test(ua)) return "tablet";
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android/.test(ua) || mobileHint === "?1") return "mobile";
  if (/Windows NT|Macintosh|CrOS|X11|Linux x86_64/.test(ua)) return "desktop";
  return "unknown";
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

export function getOrderClientInfo(request: Request): OrderClientInfo {
  const headers = request.headers;
  const userAgent = clean(headers.get("user-agent"), 1000);
  const ua = userAgent ?? "";
  const platformHeader = headers.get("x-client-platform")?.trim().toLowerCase();
  const requestedWith = headers.get("x-requested-with")?.trim();

  let clientSource: OrderClientSource = "unknown";
  if (platformHeader === "android") clientSource = "android_app";
  else if (platformHeader === "ios") clientSource = "ios_app";
  else if (requestedWith === ANDROID_APP_PACKAGE) clientSource = "android_app";
  else if (/^okhttp\//i.test(ua)) clientSource = "android_app";
  else if (/CFNetwork\//.test(ua) && !/^Mozilla\//.test(ua)) clientSource = "ios_app";
  else if (/^Mozilla\//.test(ua)) clientSource = "web";

  const isApp = clientSource === "android_app" || clientSource === "ios_app";
  const appDevice = isApp ? deviceFromAppHeader(headers.get("x-client-device")) : "unknown";
  const clientDeviceType =
    appDevice !== "unknown" ? appDevice : detectDeviceFromUa(ua, headers.get("sec-ch-ua-mobile"));

  return {
    clientSource,
    clientDeviceType,
    clientBrowser: clean(detectBrowser(ua), 60),
    clientOs: clean(isApp ? headers.get("x-client-os") : null, 60) ?? clean(detectOs(ua), 60),
    clientAppVersion: isApp ? clean(headers.get("x-app-version"), 40) : null,
    clientUserAgent: userAgent,
    clientIp: clean(getClientIp(request), 64),
  };
}