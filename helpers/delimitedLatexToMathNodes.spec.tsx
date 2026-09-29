import { convertDelimitedLatex, inspectRichText } from "./delimitedLatexToMathNodes";
import { QUESTION_FORMAT_DOCS, QUESTION_RICH_TEXT_FIELDS } from "./mcpQuestionFormatDocs";
import { renderMathInHtml } from "./renderMathInHtml";

const convert = (html: string) => convertDelimitedLatex(html).html;
const node = (latex: string) => `<span data-type="inline-math" data-latex="${latex}"></span>`;

describe("convertDelimitedLatex", () => {
  it("turns $...$ in plain text into an inline math node", () => {
    const result = convertDelimitedLatex("Evaluate $\\int_0^1 (x^4 - 3x^3 + 2x) dx$");
    expect(result.converted).toBe(1);
    expect(result.html).toBe(`Evaluate ${node("\\int_0^1 (x^4 - 3x^3 + 2x) dx")}`);
  });

  it("handles \\( \\) inside paragraphs and decodes entities in the source", () => {
    expect(convert("<p>If \\(a &lt; b\\) then</p>")).toBe(`<p>If ${node("a &lt; b")} then</p>`);
  });

  it("turns display math into inline nodes in display style", () => {
    expect(convert("<p>$$\\frac{1}{2}$$</p>")).toBe(`<p>${node("\\displaystyle \\frac{1}{2}")}</p>`);
    expect(convert("<p>So \\[x = 1\\] holds</p>")).toBe(`<p>So ${node("\\displaystyle x = 1")} holds</p>`);
  });

  it("leaves prices and escaped dollars as text", () => {
    expect(convertDelimitedLatex("<p>It costs $5 and $10.</p>").converted).toBe(0);
    expect(convert("<p>Pay \\$5 for $x$</p>")).toBe(`<p>Pay $5 for ${node("x")}</p>`);
  });

  it("does not touch existing math nodes, attributes or code", () => {
    const html = `<p>${node("$a$")} <img alt="$b$" src="x.png"></p><pre><code>$c$</code></pre>`;
    expect(convertDelimitedLatex(html)).toEqual({ html, converted: 0 });
  });

  it("escapes quotes and ampersands so the renderer reads the source back", () => {
    const html = convert('$\\begin{matrix} a & b \\end{matrix} \\text{"q"}$');
    expect(html).toContain('data-latex="\\begin{matrix} a &amp; b \\end{matrix} \\text{&quot;q&quot;}"');
    expect(renderMathInHtml(html)).toContain("katex");
  });

  it("repairs commands that JSON turned into control characters", () => {
    // "\frac", "\times", "\theta" and "\neq" sent with one backslash in JSON.
    const damaged = "$2P = \frac{P \times r}{100}$ and $\theta \neq 0$";
    expect(convert(damaged)).toBe(`${node("2P = \\frac{P \\times r}{100}")} and ${node("\\theta \\neq 0")}`);
    expect(convert(`<p>${node("\frac{1}{2}")}</p>`)).toBe(`<p>${node("\\frac{1}{2}")}</p>`);
  });

  it("keeps a trailing control space", () => {
    expect(convert("\\(\\frac{MA}{CA} \\times 100\\ \\)")).toBe(node("\\frac{MA}{CA} \\times 100\\ "));
  });

  it("drops the stray backslash of a doubled closing delimiter and fixes \\left\\\\{", () => {
    expect(convert("\\(\\frac{MA}{CA} \\times 100\\\\)")).toBe(node("\\frac{MA}{CA} \\times 100"));
    expect(convert("\\(\\left\\\\{ x \\right\\\\} \\\\)")).toBe(node("\\left\\{ x \\right\\}"));
    expect(convert("$a \\\\ b$")).toBe(node("a \\\\ b"));
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

  it("refuses block-math and malformed inline nodes", () => {
    expect(inspectRichText('<div data-type="block-math" data-latex="x"></div>').errors[0]).toContain(
      "block-math is not shown"
    );
    expect(inspectRichText('<div data-type="inline-math" data-latex="x"></div>').errors[0]).toContain(
      "must be a <span>"
    );
    expect(inspectRichText('<span data-type="inline-math"></span>').errors[0]).toContain("no data-latex");
  });

  it("refuses a tag broken by a raw < in data-latex", () => {
    expect(inspectRichText(`<p>${node("a<b")}</p>`).errors[0]).toContain("could not be read");
  });

  it("warns about an unclosed $, stray LaTeX, double escaping, Markdown and tags the editor drops", () => {
    const result = check("<p>**Find** $x^2 + \\frac12 and H<sub>2</sub>O, then $\\\\frac{1}{2}$</p>");
    expect(result.errors).toEqual([]);
    const text = result.warnings.join(" ");
    expect(text).toContain("was left as text");
    expect(text).toContain("\\frac");
    expect(text).toContain("double-escaped");
    expect(text).toContain("Markdown");
    expect(text).toContain("<sub>");
  });
});
