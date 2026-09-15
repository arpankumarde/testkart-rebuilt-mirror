import katex from "katex";

// Tiptap's Mathematics extension stores formulas as empty inline-math / block-math
// nodes carrying the source in data-latex. String-based so it also runs during SSR.
const MATH_NODE_PATTERN = /<(span|div)(\s[^>]*?\bdata-type="(inline-math|block-math)"[^>]*)>([^<]*)<\/\1>/g;
const LATEX_ATTRIBUTE_PATTERN = /\bdata-latex="([^"]*)"/;

const decodeAttribute = (value: string): string =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

export const renderMathInHtml = (html: string): string => {
  if (!html.includes('-math"')) return html;

  return html.replace(MATH_NODE_PATTERN, (match, tag: string, attributes: string, type: string) => {
    const latex = attributes.match(LATEX_ATTRIBUTE_PATTERN)?.[1];
    if (!latex) return match;

    const rendered = katex.renderToString(decodeAttribute(latex), {
      throwOnError: false,
      displayMode: type === "block-math",
    });
    return `<${tag}${attributes}>${rendered}</${tag}>`;
  });
};
