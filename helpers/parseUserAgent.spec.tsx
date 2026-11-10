import { parseUserAgent } from "./parseUserAgent";

describe("parseUserAgent", () => {
  const cases: [string, string, { deviceType: string; os: string; browser: string }][] = [
    [
      "Chrome on Windows",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      { deviceType: "Desktop", os: "Windows 10/11", browser: "Chrome 131" },
    ],
    [
      "Edge on Windows",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70",
      { deviceType: "Desktop", os: "Windows 10/11", browser: "Edge 131" },
    ],
    [
      "Safari on macOS",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
      { deviceType: "Desktop", os: "macOS", browser: "Safari 18.1" },
    ],
    [
      "Firefox on Linux",
      "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
      { deviceType: "Desktop", os: "Linux", browser: "Firefox 133" },
    ],
    [
      "Chrome on Android phone",
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      { deviceType: "Mobile", os: "Android", browser: "Chrome 131" },
    ],
    [
      "Samsung Internet on Android 14",
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
      { deviceType: "Mobile", os: "Android 14", browser: "Samsung Internet 26" },
    ],
    [
      "Safari on iPhone",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      { deviceType: "Mobile", os: "iOS 17.5", browser: "Safari 17.5" },
    ],
    [
      "Chrome on iPad",
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
      { deviceType: "Tablet", os: "iPadOS 17.5", browser: "Chrome 131" },
    ],
    [
      "Android tablet",
      "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      { deviceType: "Tablet", os: "Android 13", browser: "Chrome 131" },
    ],
    [
      "Android WebView",
      "Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SD1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36",
      { deviceType: "Mobile", os: "Android 12", browser: "Android WebView 120" },
    ],
    [
      "Googlebot",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      { deviceType: "Bot", os: "Unknown", browser: "Unknown" },
    ],
  ];

  for (const [name, ua, expected] of cases) {
    it(name, () => {
      expect(parseUserAgent(ua)).toEqual(expected as never);
    });
  }

  it("uses client hints when the string is ambiguous", () => {
    expect(parseUserAgent("SomeApp/1.0", { mobile: "?1", platform: '"Android"' })).toEqual({
      deviceType: "Mobile",
      os: "Android",
      browser: "Unknown",
    });
  });

  it("handles a missing User-Agent", () => {
    expect(parseUserAgent(null)).toEqual({ deviceType: "Unknown", os: "Unknown", browser: "Unknown" });
  });
});