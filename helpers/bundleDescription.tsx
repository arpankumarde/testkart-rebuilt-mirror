import { isHtmlWriteup } from "./newsWriteup";
import { htmlToPlainText } from "./courseDraft";

// Bundle descriptions are written in the rich text editor as HTML. Older ones
// are plain text or light markdown (# and ## headings, **bold**, - or * list
// lines, "1." numbered lines), so every reader goes through these helpers
// rather than assuming one shape.

const RICH_CONTENT_TAG = /<(img|video|iframe|table|hr)\b/i;

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const markdownToHtml = (text: string): string => {
  let html = escapeHtml(text)
    .replace(/^#\s+(.*)$/gm, "\n\n<h2>$1</h2>\n\n")
    .replace(/^##\s+(.*)$/gm, "\n\n<h3>$1</h3>\n\n")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Each list is set off as its own block. A list glued to the line above it
  // (e.g. "Why buy this bundle:" then "- ...") used to end up inside that
  // line's <p>, which is invalid HTML that browsers repair unpredictably.
  // Blank lines between items do not break a list in two.
  html = html.replace(/(?:^[*-]\s+.*(?:\n+|$))+/gm, (match) => {
    const items = match.trim().split(/\n+/).map((line) => `<li>${line.replace(/^[*-]\s+/, "")}</li>`).join("");
    return `\n\n<ul>${items}</ul>\n\n`;
  });

  // "1. Chapter" lines become a real numbered list that keeps the teacher's
  // own starting number. Capped at three digits so a year cannot start one.
  html = html.replace(/(?:^\d{1,3}[.)]\s+.*(?:\n+|$))+/gm, (match) => {
    const lines = match.trim().split(/\n+/);
    const start = parseInt(lines[0], 10);
    const items = lines.map((line) => `<li>${line.replace(/^\d{1,3}[.)]\s+/, "")}</li>`).join("");
    return `\n\n<ol${start !== 1 ? ` start="${start}"` : ""}>${items}</ol>\n\n`;
  });

  return html
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => (/^<(h[23]|ul|ol)\b/.test(block) ? block : `<p>${block.replace(/\n/g, "<br>")}</p>`))
    .join("\n");
};

/** HTML for the editor and the bundle page: HTML passes through, older text is converted. */
export const bundleDescriptionToHtml = (description: string | null | undefined): string => {
  if (!description) return "";
  return isHtmlWriteup(description) ? description : markdownToHtml(description);
};

/** Collapsed text for meta descriptions. */
export const bundleDescriptionToPlainText = (description: string | null | undefined): string =>
  htmlToPlainText(bundleDescriptionToHtml(description));

/** An editor left with no text and no media (e.g. "<p></p>") saves as an empty description. */
export const normalizeBundleDescription = (html: string | null | undefined): string => {
  if (!html) return "";
  return bundleDescriptionToPlainText(html) || RICH_CONTENT_TAG.test(html) ? html : "";
};