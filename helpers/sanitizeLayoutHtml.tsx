import xss from "xss";
import type * as XssModule from "xss";
import { htmlFilterOptions, makeButtonsInert } from "./sanitizeHtml";

const { FilterXSS, friendlyAttrValue, escapeAttrValue } = xss as unknown as typeof XssModule;

/**
 * The sanitizer for static exam content written in the editor's HTML mode, on
 * save and on render. It keeps everything sanitizeHtml keeps and drops everything
 * it drops, but pasted layouts also need a wider CSS allow list and <style>
 * blocks, so those two are handled here. Rich text keeps using sanitizeHtml, and
 * content with scripts or form controls runs in a sandboxed frame instead
 * (helpers/htmlFrame), since sanitizing would remove what makes it work.
 *
 * Stylesheets are rebuilt rule by rule from allow-listed selectors, properties
 * and values, so no <, {, } or backslash from the input can reach the output.
 * With `scoped`, every selector is prefixed with .tk-html-content and the markup
 * is wrapped in that class, so a page's styles cannot reach the site around it.
 * Saved content stays unscoped, so reopening the editor shows the CSS as written.
 *
 * Plain string processing, like sanitizeHtml, so SSR and the browser agree.
 */

const SCOPE_CLASS = "tk-html-content";
const SCOPE = `.${SCOPE_CLASS}`;

const blockAttrs = htmlFilterOptions.whiteList.div ?? [];
const whiteList = {
  ...htmlFilterOptions.whiteList,
  main: blockAttrs,
  hgroup: blockAttrs,
  kbd: blockAttrs,
  samp: blockAttrs,
  var: blockAttrs,
  dfn: blockAttrs,
  q: blockAttrs,
  wbr: blockAttrs,
  time: [...blockAttrs, "datetime"],
};

// Document wrappers around a pasted full page; losing them loses nothing.
const WRAPPER_TAGS = new Set(["!doctype", "html", "head", "body", "meta", "title"]);

const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi;
const UNSAFE_URL = /^\s*(?:javascript|vbscript):/i;

const CSS_PROPERTY = new RegExp(
  `^(?:${[
    "--[a-z0-9_-]+",
    "display|visibility|opacity|float|clear|box-sizing|aspect-ratio|vertical-align",
    "object-(?:fit|position)",
    "(?:min-|max-)?(?:width|height)",
    "(?:margin|padding)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?",
    "border(?:-[a-z]+)*|outline(?:-[a-z]+)?|box-shadow",
    "background(?:-[a-z]+)*|color",
    "font(?:-[a-z]+)*|line-height|letter-spacing|word-(?:spacing|break)|overflow-wrap|white-space|hyphens",
    "text-[a-z]+(?:-[a-z]+)*|list-style(?:-[a-z]+)?",
    "table-layout|caption-side|empty-cells",
    "flex(?:-[a-z]+)?|order|gap|row-gap|column-gap|(?:align|justify|place)-[a-z]+",
    "grid(?:-[a-z]+)*|columns|column-[a-z]+",
    "position|top|right|bottom|left|inset|z-index|overflow(?:-[xy])?",
    "transform(?:-origin)?|transition(?:-[a-z]+)*|cursor|content|counter-(?:reset|increment)",
  ].join("|")})$`,
  "i"
);

const UNSAFE_CSS_VALUE = /[<>{}\\]|\/\*|expression\s*\(|javascript:|vbscript:/i;
const SAFE_CSS_URL = /url\(\s*(["']?)(?:https:\/\/|\/_cdn\/)[^"'()\s]*\1\s*\)/gi;
const SELECTOR_CHARS = /^[\w\s.#:,>+~*()[\]="'^$|%-]+$/;
const DOCUMENT_ROOT = /^(?:(?:html|body|:root)(?![\w-])\s*)+/i;
const CONDITIONAL_RULE = /^@(?:media|supports)\s[\w\s().:,/-]+$/i;

const isBalanced = (value: string): boolean => {
  const quotes = (value.match(/["']/g) ?? []).length;
  const opens = (value.match(/\(/g) ?? []).length;
  const closes = (value.match(/\)/g) ?? []).length;
  return quotes % 2 === 0 && opens === closes;
};

const isSafeCssValue = (name: string, value: string): boolean => {
  if (UNSAFE_CSS_VALUE.test(value) || !isBalanced(value)) return false;
  // A fixed or sticky element would sit on top of the site, outside the content.
  if (name === "position" && /fixed|sticky/i.test(value)) return false;
  return !/url\(/i.test(value.replace(SAFE_CSS_URL, ""));
};

const cleanDeclarations = (text: string, removed: Set<string>): string[] => {
  const kept: string[] = [];
  for (const part of text.split(";")) {
    const colon = part.indexOf(":");
    if (colon < 1) continue;
    const rawName = part.slice(0, colon).trim();
    const name = rawName.startsWith("--") ? rawName : rawName.toLowerCase();
    const value = part.slice(colon + 1).trim().replace(/\s+/g, " ");
    if (!value) continue;
    if (CSS_PROPERTY.test(name) && isSafeCssValue(name, value)) kept.push(`${name}: ${value}`);
    else removed.add(/^-{0,2}[\w-]+$/.test(name) ? `CSS ${name}` : "nested or unsupported CSS");
  }
  return kept;
};

// Commas inside :is(...) or [...] don't separate selectors.
const splitSelectors = (list: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of list) {
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
};

const cleanSelector = (list: string, scoped: boolean, removed: Set<string>): string => {
  if (!SELECTOR_CHARS.test(list)) {
    removed.add("unsupported CSS selector");
    return "";
  }
  const selectors: string[] = [];
  for (const part of splitSelectors(list)) {
    const selector = part.trim().replace(/\s+/g, " ");
    if (!selector) continue;
    const inner = selector.replace(DOCUMENT_ROOT, "");
    // A leading sibling combinator would match outside the scope element.
    if (/^[+~]/.test(inner)) {
      removed.add("unsupported CSS selector");
      continue;
    }
    if (!scoped) selectors.push(selector);
    else selectors.push(inner ? `${SCOPE} ${inner}` : SCOPE);
  }
  return selectors.join(", ");
};

type CssBlock = { prelude: string; body: string };

const parseBlocks = (css: string, removed: Set<string>): CssBlock[] => {
  const blocks: CssBlock[] = [];
  let start = 0;
  while (start < css.length) {
    const open = css.indexOf("{", start);
    if (open < 0) break;
    const semicolon = css.indexOf(";", start);
    // A statement such as @import has no block of its own.
    if (semicolon >= 0 && semicolon < open) {
      const statement = css.slice(start, semicolon).trim();
      if (statement) removed.add(statement.split(/\s/)[0]);
      start = semicolon + 1;
      continue;
    }
    let depth = 1;
    let end = open + 1;
    while (end < css.length && depth > 0) {
      if (css[end] === "{") depth += 1;
      if (css[end] === "}") depth -= 1;
      end += 1;
    }
    if (depth > 0) break;
    blocks.push({ prelude: css.slice(start, open).trim(), body: css.slice(open + 1, end - 1) });
    start = end;
  }
  return blocks;
};

const cleanRules = (css: string, scoped: boolean, removed: Set<string>, indent = ""): string[] => {
  const rules: string[] = [];
  for (const { prelude, body } of parseBlocks(css, removed)) {
    if (prelude.startsWith("@")) {
      if (!CONDITIONAL_RULE.test(prelude)) {
        removed.add(prelude.split(/\s/)[0]);
        continue;
      }
      const inner = cleanRules(body, scoped, removed, `${indent}  `);
      if (inner.length > 0) rules.push(`${indent}${prelude} {\n${inner.join("\n")}\n${indent}}`);
      continue;
    }
    const selector = cleanSelector(prelude, scoped, removed);
    const declarations = cleanDeclarations(body, removed);
    if (selector && declarations.length > 0) {
      const lines = declarations.map((declaration) => `${indent}  ${declaration};`);
      rules.push(`${indent}${selector} {\n${lines.join("\n")}\n${indent}}`);
    }
  }
  return rules;
};

const cleanStylesheet = (css: string, scoped: boolean, removed: Set<string>): string =>
  cleanRules(css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--|-->/g, ""), scoped, removed).join("\n");

const buildFilter = (removed: Set<string>) =>
  new FilterXSS({
    ...htmlFilterOptions,
    whiteList,
    css: false,
    stripIgnoreTagBody: [...htmlFilterOptions.stripIgnoreTagBody, "head", "title"],
    onTag(tag, html) {
      if (!html.startsWith("</") && !(tag in whiteList) && !WRAPPER_TAGS.has(tag)) removed.add(`<${tag}>`);
      return undefined;
    },
    onTagAttr(tag, name, value) {
      if (/^on/i.test(name)) removed.add(name);
      if (name === "style") {
        const kept = cleanDeclarations(friendlyAttrValue(value), removed);
        return kept.length > 0 ? `style="${escapeAttrValue(kept.join("; "))}"` : "";
      }
      if ((name === "href" || name === "src") && UNSAFE_URL.test(friendlyAttrValue(value))) {
        removed.add("javascript: links");
      }
      const result = htmlFilterOptions.onTagAttr(tag, name, value);
      if (tag === "iframe" && result === "") removed.add("iframes other than YouTube and Vimeo");
      return result;
    },
  });

export function sanitizeLayoutHtml(
  source: string | null | undefined,
  { scoped = false }: { scoped?: boolean } = {}
): { html: string; removed: string[] } {
  const removed = new Set<string>();
  const sheets: string[] = [];
  const markup = (source ?? "").replace(STYLE_BLOCK, (_block, css: string) => {
    sheets.push(css);
    return "";
  });
  const stylesheet = sheets
    .map((css) => cleanStylesheet(css, scoped, removed))
    .filter(Boolean)
    .join("\n");
  const body = makeButtonsInert(buildFilter(removed).process(markup)).trim();
  const content = scoped ? `<div class="${SCOPE_CLASS}">${body}</div>` : body;
  return {
    html: stylesheet ? `<style>\n${stylesheet}\n</style>\n${content}` : content,
    removed: Array.from(removed),
  };
}