import { getTrustedClientIp, isCloudflareIp, normalizeIp } from "./trustedClientIp";
import { getClientIp } from "./getClientIp";

const req = (headers: Record<string, string>) => new Request("https://example.test/_api/x", { headers });

describe("normalizeIp", () => {
  it("accepts IPv4 and IPv6 and rejects junk", () => {
    expect(normalizeIp(" 122.161.53.65 ")).toBe("122.161.53.65");
    expect(normalizeIp("2001:0DB8:0000:0000:0000:0000:0000:0001")).toBe("2001:db8::1");
    expect(normalizeIp("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(normalizeIp("[2001:db8::2]")).toBe("2001:db8::2");
    expect(normalizeIp("256.1.1.1")).toBeNull();
    expect(normalizeIp("1.2.3")).toBeNull();
    expect(normalizeIp("<script>")).toBeNull();
    expect(normalizeIp("")).toBeNull();
  });
});

describe("isCloudflareIp", () => {
  it("matches Cloudflare ranges only", () => {
    expect(isCloudflareIp("172.70.1.2")).toBeTrue();
    expect(isCloudflareIp("162.159.200.1")).toBeTrue();
    expect(isCloudflareIp("2606:4700:10::6816:1")).toBeTrue();
    expect(isCloudflareIp("122.161.53.65")).toBeFalse();
    expect(isCloudflareIp("2001:db8::1")).toBeFalse();
  });
});

describe("getTrustedClientIp", () => {
  it("uses the edge address and ignores forged forwarding headers", () => {
    expect(
      getTrustedClientIp(
        req({
          "x-floot-client-ip": "122.161.53.65",
          "x-forwarded-for": "203.0.113.7",
          "cf-connecting-ip": "203.0.113.9",
          "true-client-ip": "203.0.113.10",
        })
      )
    ).toBe("122.161.53.65");
  });

  it("falls back to CloudFront-Viewer-Address without its port", () => {
    expect(getTrustedClientIp(req({ "cloudfront-viewer-address": "122.161.53.65:4287" }))).toBe("122.161.53.65");
    expect(getTrustedClientIp(req({ "cloudfront-viewer-address": "2001:db8::5:443" }))).toBe("2001:db8::5");
  });

  it("trusts CF-Connecting-IP only when the request came through Cloudflare", () => {
    expect(getTrustedClientIp(req({ "x-floot-client-ip": "172.70.1.2", "cf-connecting-ip": "49.36.10.20" }))).toBe("49.36.10.20");
    expect(getTrustedClientIp(req({ "x-floot-client-ip": "172.70.1.2", "cf-connecting-ip": "nonsense" }))).toBe("172.70.1.2");
  });

  it("returns null with no edge header, even if X-Forwarded-For is present", () => {
    expect(getTrustedClientIp(req({ "x-forwarded-for": "203.0.113.7" }))).toBeNull();
  });
});

describe("getClientIp", () => {
  it("follows the trusted rule, so OTP and admin limits ignore forged headers", () => {
    const forged = { "x-forwarded-for": "203.0.113.7", "x-real-ip": "203.0.113.8", "cf-connecting-ip": "203.0.113.9" };
    expect(getClientIp(req({ ...forged, "x-floot-client-ip": "122.161.53.65" }))).toBe("122.161.53.65");
    expect(getClientIp(req(forged))).toBeNull();
  });
});