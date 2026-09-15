import { sanitizeHtml, sanitizeOptionalHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("removes script tags and their contents", () => {
    expect(sanitizeHtml("<p>Hi</p><script>alert(1)</script>")).toBe("<p>Hi</p>");
  });

  it("drops event handler attributes but keeps the element", () => {
    const out = sanitizeHtml('<img src="https://cdn.testkart.in/a.png" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).toContain('src="https://cdn.testkart.in/a.png"');
  });

  it("drops javascript: links", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
  });

  it("keeps YouTube embeds and strips the src of any other iframe", () => {
    const youtube = sanitizeHtml('<iframe src="https://www.youtube.com/embed/abc" allowfullscreen></iframe>');
    expect(youtube).toContain('src="https://www.youtube.com/embed/abc"');
    const other = sanitizeHtml('<iframe src="https://evil.example/x"></iframe>');
    expect(other).not.toContain("evil.example");
  });

  it("strips svg and its script payload", () => {
    const out = sanitizeHtml('<svg onload="alert(1)"><script>alert(2)</script></svg><p>ok</p>');
    expect(out).not.toContain("svg");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>ok</p>");
  });

  it("keeps editor formatting, tables and data attributes", () => {
    const out = sanitizeHtml(
      '<table class="borderless" data-borders="false"><tbody><tr><td colspan="2" style="text-align: center">A</td></tr></tbody></table>' +
        '<p><strong>B</strong> <span data-type="inline-math" data-latex="x^2"></span></p>'
    );
    expect(out).toContain('data-borders="false"');
    expect(out).toContain('colspan="2"');
    expect(out).toContain('data-latex="x^2"');
    expect(out).toContain("text-align");
    expect(out).toContain("<strong>B</strong>");
  });

  it("keeps language video tabs as inert buttons", () => {
    const block =
      '<div class="language-video-block" data-language-video="true" data-videos="%5B%5D">' +
      '<div class="language-video-tabs" role="tablist" aria-label="Video language">' +
      '<button type="button" class="language-video-tab" role="tab" aria-selected="true" data-label="Hindi" data-language-video-tab="0"></button>' +
      "</div>" +
      '<div class="language-video-panel" role="tabpanel" data-language-video-panel="0" data-active="true">' +
      '<video src="https://cdn.testkart.in/editor-videos/a.mp4" controls="true" preload="metadata" playsinline="true"></video>' +
      "</div></div>";
    const out = sanitizeHtml(block);
    expect(out).toContain('<button type="button" class="language-video-tab" role="tab" aria-selected="true" data-label="Hindi" data-language-video-tab="0"></button>');
    expect(out).toContain('role="tablist"');
    expect(out).toContain('data-active="true"');
    expect(out).toContain('src="https://cdn.testkart.in/editor-videos/a.mp4"');
    expect(sanitizeHtml(out)).toBe(out);

    const hostile = sanitizeHtml('<form><button type="submit" formaction="https://evil.example" onclick="alert(1)">Go</button></form><p>&lt;button</p>');
    expect(hostile).toContain('<button type="button">Go</button>');
    expect(hostile).not.toContain("submit");
    expect(hostile).not.toContain("evil.example");
    expect(hostile).not.toContain("onclick");
    expect(hostile).toContain("<p>&lt;button</p>");
  });

  it("returns an empty string for empty input and keeps null or undefined for optional fields", () => {
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeOptionalHtml(null)).toBeNull();
    expect(sanitizeOptionalHtml(undefined)).toBeUndefined();
  });
});
