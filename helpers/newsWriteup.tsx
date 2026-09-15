// News writeups come from the rich text editor as HTML. Entries saved before the
// editor existed are plain text with a blank line between paragraphs, so every
// reader goes through these helpers rather than assuming one shape.

const HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9]*(\s[^>]*)?\/?>/i;
const BLOCK_BOUNDARY_PATTERN = /<\/(p|div|h[1-6]|li|td|th|tr|blockquote|figcaption|pre)>|<br\s*\/?>/gi;

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const decodeEntities = (text: string): string =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

export const isHtmlWriteup = (writeup: string): boolean => HTML_TAG_PATTERN.test(writeup);

/** Editor-ready HTML: HTML passes through, plain text becomes escaped paragraphs. */
export const writeupToHtml = (writeup: string): string => {
  if (isHtmlWriteup(writeup)) return writeup;
  return writeup
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
};

/** Collapsed text for meta descriptions and the "is it empty" check. */
export const writeupToPlainText = (writeup: string): string => {
  const text = isHtmlWriteup(writeup)
    ? decodeEntities(
        writeup
          .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
          .replace(BLOCK_BOUNDARY_PATTERN, " ")
          .replace(/<[^>]*>/g, "")
      )
    : writeup;
  return text.replace(/\s+/g, " ").trim();
};
