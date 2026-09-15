import xss from "xss";
import type * as XssModule from "xss";

// xss is CommonJS and attaches most helpers in a loop Node's ESM loader cannot see, so on the
// server only filterXSS and FilterXSS work as named imports. Read everything off the default export.
const { FilterXSS, getDefaultWhiteList, escapeAttrValue } = xss as unknown as typeof XssModule;

/**
 * The one sanitizer for user-written HTML, used both when rich text is saved
 * and wherever it is rendered with dangerouslySetInnerHTML. It is plain string
 * processing (no DOM), so SSR and the browser produce the same markup.
 *
 * Keeps formatting, tables, images, links and media, plus class/style/id/role and
 * data-* / aria-* attributes the editors rely on. Buttons are kept for the
 * language video tabs and always come out as inert type="button". Drops scripts,
 * event handler attributes, javascript: and other unsafe URLs, and any iframe
 * that isn't a YouTube or Vimeo embed.
 *
 * Math is rendered after sanitizing (renderMathInHtml), never before, since
 * KaTeX output is not on the allow list.
 */

const GLOBAL_ATTRS = ["class", "style", "id", "title", "dir", "lang", "align", "role"];

const EXTRA_TAG_ATTRS: Record<string, string[]> = {
  a: ["rel", "name"],
  button: [],
  img: ["loading", "decoding"],
  iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "scrolling", "loading", "referrerpolicy"],
  video: ["controls", "playsinline", "preload", "poster"],
  source: ["src", "type"],
  col: ["span", "width"],
  colgroup: ["span", "width"],
  table: ["border", "cellpadding", "cellspacing", "width"],
  th: ["scope", "colwidth"],
  td: ["colwidth"],
  ol: ["start", "type", "reversed"],
  ul: ["type"],
  li: ["value"],
  figure: [],
  figcaption: [],
  picture: [],
};

const whiteList = getDefaultWhiteList();
for (const tag of new Set([...Object.keys(whiteList), ...Object.keys(EXTRA_TAG_ATTRS)])) {
  whiteList[tag] = Array.from(
    new Set([...(whiteList[tag] ?? []), ...GLOBAL_ATTRS, ...(EXTRA_TAG_ATTRS[tag] ?? [])])
  );
}

const EMBED_SRC = /^https:\/\/(www\.youtube\.com\/embed\/|www\.youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)/i;
const DATA_OR_ARIA_ATTR = /^(data|aria)-[a-z0-9_.:-]+$/i;
// Text is escaped by the filter, so this only meets real button tags, whose own type was dropped.
const BUTTON_OPEN_TAG = /<button(?=[\s>])/g;

const filter = new FilterXSS({
  whiteList,
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "noscript", "template", "object", "embed"],
  onTagAttr(tag, name, value) {
    if (tag === "iframe" && name === "src") {
      const src = value.trim();
      return EMBED_SRC.test(src) ? `src="${escapeAttrValue(src)}"` : "";
    }
    return undefined;
  },
  onIgnoreTagAttr(_tag, name, value) {
    if (DATA_OR_ARIA_ATTR.test(name)) {
      return `${name}="${escapeAttrValue(value)}"`;
    }
    return undefined;
  },
});

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return filter.process(html).replace(BUTTON_OPEN_TAG, '<button type="button"');
}

/** For optional fields on save: keeps undefined and null as they are. */
export function sanitizeOptionalHtml<T extends string | null | undefined>(html: T): T {
  if (html === undefined || html === null) return html;
  return sanitizeHtml(html) as T;
}
