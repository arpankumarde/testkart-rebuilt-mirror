import { readVisitorContext } from "./readVisitorContext";

const NOW = new Date("2026-11-14T10:00:00Z");
const nowSeconds = Math.floor(NOW.getTime() / 1000);
const DAY = 24 * 60 * 60;
const VID = "3f2b8c1e-9a4d-4e2f-8b1a-0c9d8e7f6a5b";

const request = (cookie: string, headers: Record<string, string> = {}) =>
  new Request("https://testkart.in/_api/x", { headers: { cookie, ...headers } });

const touchCookie = (value: unknown) => `tk_touch=${encodeURIComponent(JSON.stringify(value))}`;

describe("readVisitorContext", () => {
  it("reads the visitor id, touches and clicked message", () => {
    const ctx = readVisitorContext(
      request(
        `tk_vid=${VID}; ${touchCookie({
          f: { r: "www.google.com", t: nowSeconds - 10 * DAY },
          l: { s: "whatsapp", c: "diwali", t: nowSeconds - DAY },
        })}; tk_mid=42`
      ),
      NOW
    );
    expect(ctx.visitorId).toBe(VID);
    expect(ctx.platform).toBe("web");
    expect(ctx.firstTouch?.source).toBe("search");
    expect(ctx.firstTouch?.referrerHost).toBe("google.com");
    expect(ctx.lastTouch?.source).toBe("share_whatsapp");
    expect(ctx.lastTouch?.utmCampaign).toBe("diwali");
    expect(ctx.messageId).toBe("42");
  });

  it("drops a last touch older than 30 days and a first touch older than 90", () => {
    const ctx = readVisitorContext(
      request(touchCookie({ f: { t: nowSeconds - 91 * DAY }, l: { s: "x", t: nowSeconds - 31 * DAY } })),
      NOW
    );
    expect(ctx.firstTouch).toBeNull();
    expect(ctx.lastTouch).toBeNull();
  });

  it("treats an untagged first touch with no referrer as direct", () => {
    const ctx = readVisitorContext(request(touchCookie({ f: { t: nowSeconds - 60 } })), NOW);
    expect(ctx.firstTouch?.source).toBe("direct");
  });

  it("rejects malformed values instead of storing them", () => {
    const ctx = readVisitorContext(
      request(`tk_vid=not-a-uuid; tk_mid=1;drop; ${touchCookie({ f: { s: "<script>", t: nowSeconds } })}`),
      NOW
    );
    expect(ctx.visitorId).toBeNull();
    expect(ctx.firstTouch?.utmSource).toBeNull();
    expect(ctx.firstTouch?.source).toBe("direct");
  });

  it("survives a cookie that is not JSON", () => {
    const ctx = readVisitorContext(request("tk_touch=%7Bbroken"), NOW);
    expect(ctx.firstTouch).toBeNull();
  });

  it("prefers the app install id and platform header", () => {
    const install = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const ctx = readVisitorContext(
      request(`tk_vid=${VID}`, { "x-client-platform": "android", "x-client-install-id": install }),
      NOW
    );
    expect(ctx.platform).toBe("android");
    expect(ctx.visitorId).toBe(install);
  });
});