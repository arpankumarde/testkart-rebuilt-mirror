import { createOAuthPopupResponseHtml, type OAuthErrorMessage } from "./oauthPopupMessage";

const breakout = "</script><script>window.__pwned = 1;</script><!--";

const errorWith = (details: string): OAuthErrorMessage => ({
  type: "OAUTH_ERROR",
  provider: "google",
  error: { message: "OAuth authentication failed", code: "oauth_error", details },
});

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

const embeddedMessage = (html: string): unknown => {
  const script = parse(html).querySelector("script")?.textContent ?? "";
  const literal = script.match(/const message = (.*);/)?.[1] ?? "";
  return JSON.parse(literal);
};

describe("createOAuthPopupResponseHtml", () => {
  it("keeps a closing script tag in the error details inside the one script element", () => {
    const doc = parse(createOAuthPopupResponseHtml(errorWith(breakout)));
    expect(doc.querySelectorAll("script").length).toBe(1);
    expect(doc.querySelector("script")?.textContent).toContain("__pwned");
  });

  it("writes no raw markup from the details into the page", () => {
    const html = createOAuthPopupResponseHtml(errorWith(breakout));
    expect(html).not.toContain("</script><script>");
    expect(html).not.toContain("<!--");
  });

  it("round-trips the message, including line and paragraph separators", () => {
    const details = breakout + " a & b " + String.fromCharCode(0x2028, 0x2029);
    const html = createOAuthPopupResponseHtml(errorWith(details));
    expect(html).not.toContain(String.fromCharCode(0x2028));
    expect(html).not.toContain(String.fromCharCode(0x2029));
    expect(embeddedMessage(html)).toEqual(errorWith(details));
  });

  it("round-trips a success message unchanged", () => {
    const success = {
      type: "OAUTH_TOKEN_SUCCESS" as const,
      provider: "google" as const,
      token: "4f1c2d3e-0000-4000-8000-000000000000",
      redirectTo: "/student/dashboard?tab=tests&page=2",
    };
    expect(embeddedMessage(createOAuthPopupResponseHtml(success))).toEqual(success);
  });

  it("control: the previous raw JSON.stringify embedding broke out", () => {
    const legacy = `<script>const message = ${JSON.stringify(errorWith(breakout))};</script>`;
    expect(parse(legacy).querySelectorAll("script").length).toBe(2);
  });
});