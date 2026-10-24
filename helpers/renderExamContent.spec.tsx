import { wrapContentTables } from "./contentTables";
import { linkContentToc } from "./contentToc";
import { HTML_CONTENT_MARKER, isInteractiveHtml, parseExamContent, serializeExamContent } from "./examContentTypes";
import { renderExamContent } from "./renderExamContent";
import { renderMathInHtml } from "./renderMathInHtml";
import { sanitizeHtml } from "./sanitizeHtml";

describe("exam content format", () => {
  it("treats content without the marker as rich text", () => {
    expect(parseExamContent("<p>Hi</p>")).toEqual({ format: "rich", body: "<p>Hi</p>" });
    expect(parseExamContent(null)).toEqual({ format: "rich", body: "" });
  });

  it("round-trips HTML mode content", () => {
    const stored = serializeExamContent("html", "<div>Hi</div>");
    expect(stored.startsWith(HTML_CONTENT_MARKER)).toBe(true);
    expect(parseExamContent(stored)).toEqual({ format: "html", body: "<div>Hi</div>" });
  });

  it("adds no marker to rich text or to empty HTML", () => {
    expect(serializeExamContent("rich", "<p>Hi</p>")).toBe("<p>Hi</p>");
    expect(serializeExamContent("html", "  ")).toBe("  ");
  });

  it("treats scripts and form controls as HTML even without the marker", () => {
    const pasted = '<p>hi</p><input id="a"><script>go()</script>';
    expect(parseExamContent(pasted)).toEqual({ format: "html", body: pasted });
  });

  it("detects what needs a frame and nothing else", () => {
    for (const html of ["<script>x</script>", "<form></form>", "<INPUT>", '<select id="a"></select>', '<div onclick="x()">a</div>']) {
      expect(isInteractiveHtml(html)).withContext(html).toBe(true);
    }
    for (const html of [
      "<p>Plain text on x = 3</p>",
      "<pre>&lt;script&gt;alert(1)&lt;/script&gt;</pre>",
      "<!-- <script>old</script> --><p>a</p>",
      '<button type="button" class="language-video-tab" role="tab"></button>',
      '<div style="display: grid"><style>.a{}</style></div>',
    ]) {
      expect(isInteractiveHtml(html)).withContext(html).toBe(false);
    }
  });
});

describe("renderExamContent", () => {
  const rich =
    '<h2>Topics</h2><table><tbody><tr><td>A</td></tr></tbody></table><p><span data-type="inline-math" data-latex="x^2"></span></p><iframe src="https://evil.example/x"></iframe>';

  it("renders rich text exactly as the public pages did", () => {
    expect(renderExamContent(rich)).toBe(wrapContentTables(linkContentToc(sanitizeHtml(rich))));
    expect(renderExamContent(rich, { math: true })).toBe(
      wrapContentTables(renderMathInHtml(linkContentToc(sanitizeHtml(rich))))
    );
  });

  it("returns nothing for blank content", () => {
    expect(renderExamContent("  ")).toBe("");
    expect(renderExamContent(null)).toBe("");
    expect(renderExamContent(HTML_CONTENT_MARKER)).toBe("");
  });

  it("scopes HTML mode content and leaves its tables unframed", () => {
    const out = renderExamContent(
      serializeExamContent("html", "<style>th { color: red }</style><h2>Plan</h2><table><tr><th>A</th></tr></table>")
    );
    expect(out).toContain(".tk-html-content th {");
    expect(out).toContain('<div class="tk-html-content">');
    expect(out).toContain('id="plan"');
    expect(out).not.toContain("tk-content-table");
  });

  it("sanitizes static HTML mode content into the page", () => {
    const out = renderExamContent(serializeExamContent("html", '<p>ok</p><a href="javascript:alert(1)">x</a>'));
    expect(out).not.toContain("tk:html-mode");
    expect(out).not.toContain("javascript");
    expect(out).not.toContain("<iframe");
    expect(out).toContain("<p>ok</p>");
  });

  it("runs interactive content only inside a sandboxed frame, with or without the marker", () => {
    const calculator = '<input id="a"><button onclick="go()">Go</button><script>window.go = function () {};</script>';
    for (const stored of [serializeExamContent("html", calculator), calculator]) {
      const out = renderExamContent(stored);
      const sandbox = /^<iframe [^>]*sandbox="([^"]*)"/.exec(out)?.[1] ?? "";
      expect(sandbox).toContain("allow-scripts");
      expect(sandbox).not.toContain("allow-same-origin");
      expect(sandbox).not.toContain("allow-top-navigation");
      // Everything from the content is escaped into srcdoc: the only tag is the iframe.
      expect(out.match(/</g)?.length).toBe(2);
      expect(out.match(/<\/?[a-z]+/g)).toEqual(["<iframe", "</iframe"]);
    }
  });

  it("cannot break out of the srcdoc attribute", () => {
    const out = renderExamContent('<input value="x"></iframe><script>parent.document.cookie</script>');
    expect(out.match(/<\/?[a-z]+/g)).toEqual(["<iframe", "</iframe"]);
    expect(out.endsWith("></iframe>")).toBe(true);
  });

  it("leaves the frame's background to the page and keeps it from scrolling vertically", () => {
    const out = renderExamContent('<input id="a">');
    expect(out).toContain("background:transparent");
    expect(out).toContain("overflow-y:hidden!important");
    expect(out).not.toContain("background:#fff");
  });
});