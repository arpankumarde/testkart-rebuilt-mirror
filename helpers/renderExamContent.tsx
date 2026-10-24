import { wrapContentTables } from "./contentTables";
import { linkContentToc } from "./contentToc";
import { isInteractiveHtml, parseExamContent } from "./examContentTypes";
import { buildHtmlFrame } from "./htmlFrame";
import { renderMathInHtml } from "./renderMathInHtml";
import { sanitizeHtml } from "./sanitizeHtml";
import { sanitizeLayoutHtml } from "./sanitizeLayoutHtml";

/**
 * Stored exam content to safe markup, for the public pages and the editor's
 * preview. Headings get ids and the article's table of contents becomes jump
 * links before math is rendered, so KaTeX markup never reaches the matcher. HTML
 * mode tables are left out of the content table frame, whose !important width
 * and header band would override the layout's own styling.
 *
 * HTML mode content that needs its scripts or controls is not sanitized into the
 * page: it runs whole inside a sandboxed frame. Pair this with useHtmlFrame
 * wherever the result is rendered.
 */
export function renderExamContent(stored: string | null | undefined, { math = false }: { math?: boolean } = {}): string {
  const { format, body } = parseExamContent(stored);
  if (!body.trim()) return "";

  if (format === "html") {
    if (isInteractiveHtml(body)) return buildHtmlFrame(body);
    const linked = linkContentToc(sanitizeLayoutHtml(body, { scoped: true }).html);
    return math ? renderMathInHtml(linked) : linked;
  }

  const linked = linkContentToc(sanitizeHtml(body));
  return wrapContentTables(math ? renderMathInHtml(linked) : linked);
}
