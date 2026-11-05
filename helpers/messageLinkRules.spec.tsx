import { isLinkPrefetch, safeRedirectPath } from "./messageLinkRules";

const CHROME =
  "Mozilla/5.0 (Linux; Android 13; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";

describe("safeRedirectPath", () => {
  it("keeps same-site paths with their query and hash", () => {
    expect(safeRedirectPath("/cart")).toBe("/cart");
    expect(safeRedirectPath("/order/12?retry=1#pay")).toBe("/order/12?retry=1#pay");
  });

  it("refuses anything that could leave the site", () => {
    expect(safeRedirectPath("https://evil.example/x")).toBeNull();
    expect(safeRedirectPath("//evil.example/x")).toBeNull();
    expect(safeRedirectPath("/\\evil.example")).toBeNull();
    expect(safeRedirectPath("javascript:alert(1)")).toBeNull();
    expect(safeRedirectPath("/a\nb")).toBeNull();
    expect(safeRedirectPath("")).toBeNull();
    expect(safeRedirectPath(null)).toBeNull();
  });

  it("refuses API paths so a link cannot loop or call an endpoint", () => {
    expect(safeRedirectPath("/_api/go?c=abc")).toBeNull();
  });
});

describe("isLinkPrefetch", () => {
  const headers = (init: Record<string, string>) => new Headers(init);

  it("counts a phone browser as a person", () => {
    expect(isLinkPrefetch("GET", headers({ "user-agent": CHROME }))).toBeFalse();
  });

  it("flags WhatsApp and Facebook link previews", () => {
    expect(isLinkPrefetch("GET", headers({ "user-agent": "WhatsApp/2.23.20.0 A" }))).toBeTrue();
    expect(isLinkPrefetch("GET", headers({ "user-agent": "facebookexternalhit/1.1" }))).toBeTrue();
  });

  it("flags HEAD requests, prefetch hints and missing agents", () => {
    expect(isLinkPrefetch("HEAD", headers({ "user-agent": CHROME }))).toBeTrue();
    expect(isLinkPrefetch("GET", headers({ "user-agent": CHROME, "sec-purpose": "prefetch" }))).toBeTrue();
    expect(isLinkPrefetch("GET", headers({}))).toBeTrue();
  });
});