/**
 * Device type, operating system and browser from a User-Agent string, for the admin view of a
 * content report. Best effort and dependency-free: it names the common browsers and systems with
 * their major version and falls back to "Unknown" rather than guessing.
 */

export type DeviceType = "Desktop" | "Mobile" | "Tablet" | "Bot" | "Unknown";

export type ParsedUserAgent = { deviceType: DeviceType; os: string; browser: string };

/** Optional client hints (Sec-CH-UA-Mobile, Sec-CH-UA-Platform) that Chromium browsers send. */
export type UserAgentHints = { mobile?: string | null; platform?: string | null };

const BOT = /bot\b|bot\/|crawler|spider|crawling|slurp|headless|lighthouse|curl\/|wget\/|python-requests|python-urllib|axios\/|node-fetch|go-http-client|postmanruntime|okhttp/i;

const WINDOWS_VERSIONS: Record<string, string> = {
  "10.0": "10/11",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
  "6.0": "Vista",
  "5.1": "XP",
};

const dotted = (value: string) => value.replace(/_/g, ".").replace(/\.0$/, "");

function detectOs(ua: string, hints: UserAgentHints): string {
  let m: RegExpMatchArray | null;
  if (/Windows Phone/i.test(ua)) return "Windows Phone";
  if ((m = ua.match(/Windows NT (\d+\.\d+)/))) return `Windows ${WINDOWS_VERSIONS[m[1]] ?? m[1]}`;
  if (/Windows/i.test(ua)) return "Windows";
  if ((m = ua.match(/iPad.*?OS (\d+(?:_\d+)?)/))) return `iPadOS ${dotted(m[1])}`;
  if ((m = ua.match(/(?:iPhone|iPod).*?OS (\d+(?:_\d+)?)/))) return `iOS ${dotted(m[1])}`;
  if (/iPhone|iPod/.test(ua)) return "iOS";
  if (/iPad/.test(ua)) return "iPadOS";
  // Chrome's reduced User-Agent freezes Android at "10; K", so that pair carries no version.
  if ((m = ua.match(/Android (\d+(?:\.\d+)?)(; K\))?/))) return m[2] ? "Android" : `Android ${m[1]}`;
  if (/Android/i.test(ua)) return "Android";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Ubuntu/i.test(ua)) return "Ubuntu";
  if (/Linux|X11/.test(ua)) return "Linux";
  const platform = hints.platform?.replace(/"/g, "").trim();
  return platform || "Unknown";
}

function detectBrowser(ua: string): string {
  const named: [RegExp, string][] = [
    [/Edg(?:e|A|iOS)?\/(\d+)/, "Edge"],
    [/(?:OPR|OPiOS|OPT)\/(\d+)/, "Opera"],
    [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
    [/UCBrowser\/(\d+)/, "UC Browser"],
    [/YaBrowser\/(\d+)/, "Yandex"],
    [/Vivaldi\/(\d+)/, "Vivaldi"],
    [/MiuiBrowser\/(\d+)/, "MIUI Browser"],
    [/(?:FBAN|FBAV)\/(\d+)?/, "Facebook in-app"],
    [/Instagram (\d+)/, "Instagram in-app"],
    [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
  ];
  for (const [pattern, name] of named) {
    const m = ua.match(pattern);
    if (m) return m[1] ? `${name} ${m[1]}` : name;
  }
  let m: RegExpMatchArray | null;
  if (/; wv\)/.test(ua) && (m = ua.match(/Chrome\/(\d+)/))) return `Android WebView ${m[1]}`;
  if ((m = ua.match(/(?:Chrome|CriOS)\/(\d+)/))) return `Chrome ${m[1]}`;
  if ((m = ua.match(/Version\/(\d+(?:\.\d+)?).*Safari\//))) return `Safari ${m[1]}`;
  if (/Safari\//.test(ua)) return "Safari";
  if ((m = ua.match(/(?:MSIE |Trident\/.*rv:)(\d+)/))) return `Internet Explorer ${m[1]}`;
  return "Unknown";
}

function detectDevice(ua: string, os: string, hints: UserAgentHints): DeviceType {
  if (BOT.test(ua)) return "Bot";
  if (/iPad|Tablet|PlayBook|Kindle|Silk\//i.test(ua)) return "Tablet";
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return "Tablet";
  if (/Mobi|iPhone|iPod|Windows Phone|BlackBerry|Opera Mini/i.test(ua) || hints.mobile === "?1") return "Mobile";
  if (/^(Windows|macOS|Linux|Ubuntu|ChromeOS)/.test(os)) return "Desktop";
  return "Unknown";
}

export function parseUserAgent(userAgent: string | null | undefined, hints: UserAgentHints = {}): ParsedUserAgent {
  const ua = userAgent?.trim() ?? "";
  if (!ua) return { deviceType: "Unknown", os: "Unknown", browser: "Unknown" };
  const os = detectOs(ua, hints);
  return { deviceType: detectDevice(ua, os, hints), os, browser: detectBrowser(ua) };
}