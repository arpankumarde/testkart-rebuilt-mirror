import { convertDelimitedLatex, inspectRichText } from "./delimitedLatexToMathNodes";
import { QUESTION_FORMAT_DOCS, QUESTION_RICH_TEXT_FIELDS } from "./mcpQuestionFormatDocs";
import { renderMathInHtml } from "./renderMathInHtml";

const convert = (html: string) => convertDelimitedLatex(html).html;

describe("convertDelimitedLatex", () => {
  it("turns $...$ in plain text into an inline math node", () => {
    const result = convertDelimitedLatex("Evaluate $\\int_0^1 (x^4 - 3x^3 + 2x) dx$");
    expect(result.converted).toBe(1);
    expect(result.html).toBe(
      'Evaluate <span data-type="inline-math" data-latex="\\int_0^1 (x^4 - 3x^3 + 2x) dx"></span>'
    );
  });

  it("handles \\( \\) inside paragraphs and decodes entities in the source", () => {
    expect(convert("<p>If \\(a &lt; b\\) then</p>")).toBe(
      '<p>If <span data-type="inline-math" data-latex="a &lt; b"></span> then</p>'
    );
  });

  it("makes a paragraph holding only display math a block node", () => {
    expect(convert("<p>Find</p><p>$$\\frac{1}{2}$$</p>")).toBe(
      '<p>Find</p><div data-type="block-math" data-latex="\\frac{1}{2}"></div>'
    );
    expect(convert("\\[x^2\\]")).toBe('<div data-type="block-math" data-latex="x^2"></div>');
  });

  it("keeps display math inside a sentence inline, in display style", () => {
    expect(convert("<p>So $$x = 1$$ holds</p>")).toBe(
      '<p>So <span data-type="inline-math" data-latex="\\displaystyle x = 1"></span> holds</p>'
    );
  });

  it("leaves prices and escaped dollars as text", () => {
    expect(convertDelimitedLatex("<p>It costs $5 and $10.</p>").converted).toBe(0);
    expect(convert("<p>Pay \\$5 for $x$</p>")).toBe(
      '<p>Pay $5 for <span data-type="inline-math" data-latex="x"></span></p>'
    );
  });

  it("does not touch existing math nodes, attributes or code", () => {
    const html =
      '<p><span data-type="inline-math" data-latex="$a$"></span> <img alt="$b$" src="x.png"></p><pre><code>$c$</code></pre>';
    expect(convertDelimitedLatex(html)).toEqual({ html, converted: 0 });
  });

  it("escapes quotes and ampersands so the renderer reads the source back", () => {
    const html = convert('$\\begin{matrix} a & b \\end{matrix} \\text{"q"}$');
    expect(html).toContain('data-latex="\\begin{matrix} a &amp; b \\end{matrix} \\text{&quot;q&quot;}"');
    expect(renderMathInHtml(html)).toContain("katex");
  });
});

describe("inspectRichText", () => {
  const check = (html: string) => inspectRichText(convertDelimitedLatex(html).html);

  it("passes well-formed math and plain prices", () => {
    expect(check("<p>Evaluate $\\int_0^1 x\\,dx$ for $5.</p>")).toEqual({ formulas: 1, errors: [], warnings: [] });
  });

  it("keeps the docs example clean in every field", () => {
    const body = QUESTION_FORMAT_DOCS.example.body as Record<string, unknown>;
    for (const field of QUESTION_RICH_TEXT_FIELDS) {
      const value = body[field];
      if (typeof value !== "string") continue;
      const result = inspectRichText(value);
      expect(result.errors).withContext(field).toEqual([]);
      expect(result.warnings).withContext(field).toEqual([]);
      expect(convertDelimitedLatex(value).html).withContext(field).toBe(value);
    }
  });

  it("refuses formulas KaTeX cannot render", () => {
    const result = check("<p>$\\frac{1}{$</p>");
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain("does not render");
  });

  it("refuses unclosed delimiters", () => {
    expect(check("<p>Solve \\(x^2 = 4</p>").errors[0]).toContain("Unclosed formula delimiter");
    expect(check("<p>$$x^2</p>").errors[0]).toContain("Unclosed formula delimiter");
  });

  it("refuses math nodes on the wrong tag or inside a paragraph", () => {
    expect(inspectRichText('<p><span data-type="block-math" data-latex="x"></span></p>').errors.join(" ")).toContain(
      "block-math must be a <div>"
    );
    expect(inspectRichText('<p>a<div data-type="block-math" data-latex="x"></div></p>').errors[0]).toContain(
      "cannot sit inside a <p>"
    );
    expect(inspectRichText('<span data-type="inline-math"></span>').errors[0]).toContain("no data-latex");
  });

  it("refuses a tag broken by a raw < in data-latex", () => {
    expect(inspectRichText('<p><span data-type="inline-math" data-latex="a<b"></span></p>').errors[0]).toContain(
      "could not be read"
    );
  });

  it("warns about an unclosed $, stray LaTeX, Markdown and tags the editor drops", () => {
    const result = check("<p>**Find** $x^2 + \\frac12 and H<sub>2</sub>O</p>");
    expect(result.errors).toEqual([]);
    const text = result.warnings.join(" ");
    expect(text).toContain("was left as text");
    expect(text).toContain("\\frac");
    expect(text).toContain("Markdown");
    expect(text).toContain("<sub>");
  });
});
