import { sanitizeHtml } from "./sanitizeHtml";
import { sanitizeLayoutHtml } from "./sanitizeLayoutHtml";

const clean = (html: string) => sanitizeLayoutHtml(html).html;
const scoped = (html: string) => sanitizeLayoutHtml(html, { scoped: true }).html;

describe("sanitizeLayoutHtml", () => {
  it("drops scripts, event handlers and javascript: urls and reports them", () => {
    const { html, removed } = sanitizeLayoutHtml(
      '<div onclick="alert(1)"><a href="javascript:alert(2)">x</a></div><script>alert(3)</script><p>ok</p>'
    );
    expect(html).not.toContain("alert");
    expect(html).not.toContain("javascript");
    expect(html).toContain("<p>ok</p>");
    expect(removed).toContain("onclick");
    expect(removed).toContain("<script>");
    expect(removed).toContain("javascript: links");
  });

  it("resists markup split around a style block", () => {
    const out = clean("<scr<style>a{color:red}</style>ipt>alert(1)</script>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)</script>");
  });

  it("keeps layout CSS on inline styles that sanitizeHtml would lose", () => {
    const out = clean('<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"><span>a</span></div>');
    expect(out).toContain("grid-template-columns: 1fr 1fr");
    expect(out).toContain("gap: 12px");
  });

  it("drops unsafe inline CSS, including entity-encoded values", () => {
    const out = clean(
      '<p style="color: red; position: fixed; width: expression(alert(1)); background: url(javascript:alert(1))">a</p>' +
        '<p style="background: u&#114;l(javascript:alert(2))">b</p>'
    );
    expect(out).toContain("color: red");
    expect(out).not.toContain("fixed");
    expect(out).not.toContain("expression");
    expect(out).not.toContain("javascript");
  });

  it("allows https and cdn background images only", () => {
    expect(clean('<p style="background-image: url(https://cdn.testkart.in/a.png)">a</p>')).toContain("https://cdn.testkart.in/a.png");
    expect(clean('<p style="background-image: url(/_cdn/static/a.png)">a</p>')).toContain("/_cdn/static/a.png");
    expect(clean('<p style="background-image: url(http://evil.example/a.png)">a</p>')).not.toContain("evil.example");
    expect(clean('<p style="background-image: url(data:image/svg+xml,x)">a</p>')).not.toContain("data:");
  });

  it("keeps style blocks as written when saving", () => {
    const out = clean("<style>.card { color: red }</style><div class=\"card\">a</div>");
    expect(out).toContain(".card {\n  color: red;\n}");
    expect(out).not.toContain("tk-html-content");
  });

  it("is stable when saved twice", () => {
    const once = clean(
      "<style>.a, .b > p { color: red; margin: 0 } @media (max-width: 600px) { .a { display: none } }</style><div class=\"a\" style=\"padding: 4px\">x</div>"
    );
    expect(clean(once)).toBe(once);
  });

  it("scopes every selector on render, mapping the document root to the scope", () => {
    const out = scoped(
      "<style>:root { --brand: #f60 } body { color: red } .a, h2 > span { color: blue } @media (max-width: 600px) { .a { display: none } }</style><p>x</p>"
    );
    expect(out).toContain(".tk-html-content {\n  --brand: #f60;\n}");
    expect(out).toContain(".tk-html-content {\n  color: red;\n}");
    expect(out).toContain(".tk-html-content .a, .tk-html-content h2 > span {");
    expect(out).toContain("@media (max-width: 600px) {\n  .tk-html-content .a {");
    expect(out).toContain('<div class="tk-html-content"><p>x</p></div>');
  });

  it("cannot escape the scope with a sibling combinator or a brace", () => {
    const out = scoped("<style>~ footer { display: none } body + nav { display: none } .a { color: red } } footer { display: none }</style><p>x</p>");
    expect(out).not.toContain("~ footer");
    expect(out).not.toContain("+ nav");
    expect(out).not.toMatch(/(^|\n)footer/);
  });

  it("drops imports, font faces and other at-rules", () => {
    const { html, removed } = sanitizeLayoutHtml(
      "<style>@import url(https://evil.example/a.css); @font-face { font-family: x; src: url(https://evil.example/f.woff) } .a { color: red }</style><p>x</p>"
    );
    expect(html).not.toContain("evil.example");
    expect(html).toContain("color: red");
    expect(removed).toContain("@import");
    expect(removed).toContain("@font-face");
  });

  it("never lets a style block close early", () => {
    const out = clean('<style>.a { content: "</style><script>alert(1)</script>" }</style><p>x</p>');
    expect(out).not.toContain("<script");
    const styleBody = /<style>([\s\S]*?)<\/style>/.exec(out)?.[1] ?? "";
    expect(styleBody).not.toContain("<");
  });

  it("unwraps a pasted full document without leaking its title", () => {
    const { html, removed } = sanitizeLayoutHtml(
      '<!doctype html><html><head><meta charset="utf-8"><title>Leaked</title><style>.a{color:red}</style></head><body><main class="a">x</main></body></html>'
    );
    expect(html).not.toContain("Leaked");
    expect(html).not.toContain("<html");
    expect(html).toContain('<main class="a">x</main>');
    expect(html).toContain("color: red");
    expect(removed).toEqual([]);
  });

  it("keeps what sanitizeHtml keeps", () => {
    const block = '<table class="borderless"><tbody><tr><td colspan="2">A</td></tr></tbody></table>';
    expect(clean(block)).toBe(sanitizeHtml(block));
    expect(clean('<iframe src="https://www.youtube.com/embed/abc"></iframe>')).toContain("youtube.com/embed/abc");
    expect(clean('<iframe src="https://evil.example/x"></iframe>')).not.toContain("evil.example");
    expect(clean('<button type="submit" onclick="x()">Go</button>')).toBe('<button type="button">Go</button>');
  });

  it("handles empty input", () => {
    expect(clean("")).toBe("");
    expect(sanitizeLayoutHtml(null).removed).toEqual([]);
  });
});