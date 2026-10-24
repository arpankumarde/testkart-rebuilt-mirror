import { tokenizeHtml, type HtmlTokenKind } from "./tokenizeHtml";

const pieces = (source: string, kind: HtmlTokenKind) =>
  tokenizeHtml(source)
    .filter((token) => token.kind === kind)
    .map((token) => source.slice(token.from, token.to));

describe("tokenizeHtml", () => {
  it("splits a tag into name, attributes, values and bracket", () => {
    const source = '<div class="a b" hidden data-x=1>text</div>';
    expect(pieces(source, "tag")).toEqual(["<div", ">", "</div", ">"]);
    expect(pieces(source, "attribute")).toEqual(["class", "hidden", "data-x"]);
    expect(pieces(source, "value")).toEqual(['"a b"', "1"]);
  });

  it("keeps > inside a quoted value in the value", () => {
    expect(pieces('<a title="a>b">x</a>', "value")).toEqual(['"a>b"']);
  });

  it("marks comments, entities and the doctype", () => {
    const source = "<!doctype html><!-- a\nb --><p>&amp;</p>";
    expect(pieces(source, "comment")).toEqual(["<!-- a\nb -->"]);
    expect(pieces(source, "keyword")).toEqual(["&amp;"]);
    expect(pieces(source, "tag")[0]).toBe("<!doctype html>");
  });

  it("tokenizes the CSS inside a style block", () => {
    const source = "<style>/* c */ .a:hover { color: red; margin: 0 } </style>";
    expect(pieces(source, "comment")).toEqual(["/* c */"]);
    expect(pieces(source, "keyword")).toEqual([".a:hover"]);
    expect(pieces(source, "attribute")).toEqual(["color", "margin"]);
    expect(pieces(source, "value")).toEqual(["red", "0"]);
    expect(pieces(source, "tag")).toEqual(["<style", ">", "</style", ">"]);
  });

  it("survives half-typed markup and returns ordered ranges", () => {
    for (const source of ["<", "<div", '<div class="', "<!-- open", "<style>.a {", "<script>var a = '", "&", "a < b", ""]) {
      const tokens = tokenizeHtml(source);
      tokens.forEach((token, index) => {
        expect(token.to).toBeGreaterThan(token.from);
        expect(token.to).toBeLessThanOrEqual(source.length);
        if (index > 0) expect(token.from).toBeGreaterThanOrEqual(tokens[index - 1].to);
      });
    }
  });
});