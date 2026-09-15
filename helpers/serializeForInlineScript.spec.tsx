import { serializeForInlineScript } from "./serializeForInlineScript";

const breakout = '</script><script>window.__injected = true;</script>';

const countScripts = (literal: string): number =>
  new DOMParser()
    .parseFromString(`<script>const txnid = ${literal};</script><p>after</p>`, "text/html")
    .querySelectorAll("script").length;

describe("serializeForInlineScript", () => {
  it("keeps a closing script tag inside the string literal", () => {
    expect(countScripts(serializeForInlineScript(breakout))).toBe(1);
  });

  it("control: plain JSON.stringify lets the same value break out", () => {
    expect(countScripts(JSON.stringify(breakout))).toBe(2);
  });

  it("emits no angle brackets or ampersands", () => {
    const out = serializeForInlineScript('<!-- a & b -->' + breakout);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
  });

  it("decodes back to the original value", () => {
    for (const value of [breakout, "<!--", "a & b", 'quote " and backslash \\', ""]) {
      expect(JSON.parse(serializeForInlineScript(value))).toBe(value);
    }
  });

  it("leaves real PayU transaction ids byte-for-byte unchanged", () => {
    for (const value of [
      "testkart-AbC_12-xYz9",
      "testkart-charge-4f1c2d3e-0000-4000-8000-000000000000",
    ]) {
      expect(serializeForInlineScript(value)).toBe(JSON.stringify(value));
    }
  });

  it("redirect URLs with query strings decode to the same URL", () => {
    const url = "https://testkart.in/student/dashboard?order_id=12&txnid=testkart-AbC_12-xYz9";
    expect(JSON.parse(serializeForInlineScript(url))).toBe(url);
  });
});
