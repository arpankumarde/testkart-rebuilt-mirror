const TABLE_TAG = /<table\b[^>]*>|<\/table\s*>/gi;
const BORDERLESS = /\bdata-borders\s*=\s*["']false["']|\bclass\s*=\s*["'][^"']*\bborderless\b/i;

/**
 * Wraps each top-level table in rendered rich text in the frame styled by the
 * .tk-content-table rules in base.css, so a wide table scrolls inside it rather
 * than pushing the page sideways. Tables the editor marked borderless get the
 * unframed .tk-content-table-plain. A string pass, so server and client render
 * the same markup. Nested tables are left alone.
 */
export function wrapContentTables(html: string): string {
  if (!html || !/<table\b/i.test(html)) return html;
  let depth = 0;
  return html.replace(TABLE_TAG, (tag) => {
    if (tag.charAt(1) === "/") {
      if (depth === 0) return tag;
      depth -= 1;
      return depth === 0 ? `${tag}</div>` : tag;
    }
    depth += 1;
    if (depth > 1) return tag;
    const className = BORDERLESS.test(tag) ? "tk-content-table-plain" : "tk-content-table";
    return `<div class="${className}">${tag}`;
  });
}