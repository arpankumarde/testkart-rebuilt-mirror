// Agents writing questions through the MCP connectors put math in $...$, $$...$$, \(...\) or \[...\],
// which the editor and the question screens show as plain text. convertDelimitedLatex rewrites those
// spans into the inline-math nodes the question editor inserts, and inspectRichText checks the result
// the way the editor and KaTeX will read it.
//
// Question screens (MathMLContent) render only span math nodes, so display math becomes an inline node
// in \displaystyle rather than a block-math div.

import katex from "katex";

const TOKEN_PATTERN = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^<>]*>/g;
const MATH_PATTERN =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\$])\$(?![ \xa0\n$])((?:\\\$|\n(?=[a-zA-Z])|[^$\n])+?)(?<![ \xa0\n\\])\$(?!\d)/g;
const SKIPPED_ELEMENTS = new Set(["code", "pre", "script", "style"]);
const MATH_TYPE_ATTRIBUTE = /\bdata-type="(inline-math|block-math)"/;
const LATEX_ATTRIBUTE = /\bdata-latex="([^"]*)"/;

// A command sent as "\frac" or "\times" in JSON arrives as a control character plus the rest of its
// name (form feed + "rac", tab + "imes"). Inside a formula those characters are never intended.
const JSON_ESCAPE_DAMAGE: Array<[RegExp, string]> = [
  [/\x08(?=[a-zA-Z])/g, "\\b"],
  [/\x0B(?=[a-zA-Z])/g, "\\v"],
  [/\x0C(?=[a-zA-Z])/g, "\\f"],
  [/\t(?=[a-zA-Z])/g, "\\t"],
  [/\r(?=[a-zA-Z])/g, "\\r"],
  [
    /\n(?=(?:e|eq|eg|u|i|abla|ot|otin|exists|leq|geq|mid|parallel|cong|subset|supset|subseteq|supseteq|ewline|leftarrow|rightarrow|Leftarrow|Rightarrow)(?![a-zA-Z]))/g,
    "\\n",
  ],
];

export const repairJsonEscapes = (latex: string): string =>
  JSON_ESCAPE_DAMAGE.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), latex);

type Token = { tag: boolean; value: string };

const decodeEntities = (value: string): string =>
  value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const encodeAttribute = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inlineNode = (latex: string) => `<span data-type="inline-math" data-latex="${encodeAttribute(latex)}"></span>`;

// Keeps a trailing control space ("100\ "), which trim() would turn into a lone backslash.
const trimLatex = (latex: string) => latex.replace(/^\s+/, "").replace(/(?<!\\)\s+$/, "");

const tokenize = (html: string): Token[] => {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of html.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ tag: false, value: html.slice(last, index) });
    tokens.push({ tag: true, value: match[0] });
    last = index + match[0].length;
  }
  if (last < html.length) tokens.push({ tag: false, value: html.slice(last) });
  return tokens;
};

const tagName = (tag: string): string => tag.match(/^<\/?([a-zA-Z][\w-]*)/)?.[1]?.toLowerCase() ?? "";

export type MathConversion = { html: string; converted: number };

export const convertDelimitedLatex = (html: string): MathConversion => {
  if (!/\$|\\\(|\\\[|data-latex=/.test(html)) return { html, converted: 0 };

  const tokens = tokenize(html);
  let converted = 0;
  let skipDepth = 0;

  tokens.forEach((token, index) => {
    if (token.tag) {
      const name = tagName(token.value);
      if (SKIPPED_ELEMENTS.has(name)) skipDepth = Math.max(0, skipDepth + (token.value.startsWith("</") ? -1 : 1));
      if (MATH_TYPE_ATTRIBUTE.test(token.value)) {
        token.value = token.value.replace(LATEX_ATTRIBUTE, (_, latex: string) => `data-latex="${repairJsonEscapes(latex)}"`);
      }
      return;
    }
    const previous = tokens[index - 1];
    if (skipDepth > 0 || (previous?.tag && /data-type="[^"]*math/.test(previous.value))) return;

    // An escaped \$ outside math is a literal dollar sign.
    const plain = (value: string) => value.replace(/\\\$/g, "$");
    let output = "";
    let last = 0;
    for (const match of token.value.matchAll(MATH_PATTERN)) {
      const [whole, dollars, brackets, parens, single] = match;
      const display: string | undefined = dollars ?? brackets;
      const latex = trimLatex(repairJsonEscapes(decodeEntities(display ?? parens ?? single ?? "")));
      if (!latex) continue;
      const start = match.index ?? 0;
      output += plain(token.value.slice(last, start)) + inlineNode(display === undefined ? latex : `\\displaystyle ${latex}`);
      last = start + whole.length;
      converted += 1;
    }
    token.value = output + plain(token.value.slice(last));
  });

  return { html: tokens.map((token) => token.value).join(""), converted };
};

const LEFTOVER_DELIMITER = /\$\$|\\[()[\]]/;
const DOLLAR_BEFORE_LATEX = /\$(?=[^$\n]*?(\\[a-zA-Z]|[\^_{}]))/;
const LATEX_OUTSIDE_MATH =
  /\\(frac|dfrac|sqrt|int|iint|oint|sum|prod|lim|times|div|cdot|pm|mp|le|leq|ge|geq|neq|approx|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|infty|left|right|text|mathrm|vec|hat|bar|overline|log|ln|sin|cos|tan|sec|csc|cot)(?![a-zA-Z])/;
const DOUBLE_ESCAPED = /\\\\[a-zA-Z]{2,}/;
const MARKDOWN = /\*\*[^*\n]+\*\*|(^|\n)#{1,6} \S/;
// What the question editor (StarterKit, underline, link, image, table, YouTube, math) keeps when a
// teacher opens the question. span and div carry math, embeds and video nodes.
const EDITOR_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike", "del", "code", "pre", "blockquote", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "a", "img", "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "colgroup", "col", "span", "div", "iframe", "video", "source", "figure", "figcaption",
]);

const near = (text: string, index: number) =>
  decodeEntities(text.slice(Math.max(0, index - 20), index + 30)).replace(/\s+/g, " ").trim();

export type RichTextCheck = { formulas: number; errors: string[]; warnings: string[] };

/**
 * Checks one question field after convertDelimitedLatex. Errors are what students would see broken
 * (formulas KaTeX cannot render, unclosed delimiters, math nodes the question screens skip); warnings
 * are likely mistakes that still render.
 */
export const inspectRichText = (html: string): RichTextCheck => {
  const errors = new Set<string>();
  const warnings = new Set<string>();
  let formulas = 0;
  let skipDepth = 0;

  for (const token of tokenize(html)) {
    if (token.tag) {
      if (token.value.startsWith("<!--")) continue;
      const name = tagName(token.value);
      const closing = token.value.startsWith("</");
      if (SKIPPED_ELEMENTS.has(name)) skipDepth = Math.max(0, skipDepth + (closing ? -1 : 1));
      if (closing) continue;

      const type = token.value.match(MATH_TYPE_ATTRIBUTE)?.[1];
      if (!type) {
        if (!EDITOR_TAGS.has(name)) {
          warnings.add(
            name === "sub" || name === "sup"
              ? `<${name}> is dropped when the question is opened in the editor. Use math (x_2, x^2) or Unicode instead.`
              : `<${name}> is not supported by the question editor and is dropped when the question is opened there.`
          );
        }
        continue;
      }

      formulas += 1;
      if (type === "block-math") {
        errors.add(
          'block-math is not shown on question screens. Use <span data-type="inline-math"> and start a large formula with \\displaystyle.'
        );
        continue;
      }
      if (name !== "span") errors.add(`inline-math must be a <span>, not a <${name}>; the editor drops it otherwise.`);
      const latex = token.value.match(LATEX_ATTRIBUTE)?.[1];
      if (latex === undefined) {
        errors.add("An inline-math node has no data-latex attribute.");
        continue;
      }
      const source = decodeEntities(latex);
      if (!source.trim()) {
        warnings.add("An inline-math node has an empty formula.");
        continue;
      }
      try {
        katex.renderToString(source, { throwOnError: true, strict: "ignore" });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        errors.add(`Formula "${source}" does not render: ${reason}`);
      }
      if (DOUBLE_ESCAPED.test(source)) {
        warnings.add(`Formula "${source}" has \\\\ before a command name, which reads as a line break. It may be double-escaped.`);
      }
      continue;
    }

    if (skipDepth > 0) continue;
    const text = token.value;
    if (/data-(type|latex)=/.test(text)) {
      errors.add('A tag could not be read. Inside data-latex write < as &lt;, > as &gt; and " as &quot;.');
      continue;
    }
    const delimiter = text.search(LEFTOVER_DELIMITER);
    if (delimiter >= 0) {
      errors.add(`Unclosed formula delimiter near "${near(text, delimiter)}". Close it or remove it.`);
    }
    const dollar = text.search(DOLLAR_BEFORE_LATEX);
    if (dollar >= 0) {
      warnings.add(
        `A $ near "${near(text, dollar)}" was left as text. If it starts a formula, close it with a second $; a literal dollar is written \\$.`
      );
    }
    const command = text.match(LATEX_OUTSIDE_MATH);
    if (command) warnings.add(`"${command[0]}" appears outside a formula and will show as raw text. Wrap it in $...$.`);
    if (MARKDOWN.test(text)) warnings.add("Markdown is not rendered. Use <strong>, <em> and <h2> instead.");
  }

  return { formulas, errors: [...errors], warnings: [...warnings] };
};
