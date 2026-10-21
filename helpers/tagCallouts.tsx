export type CalloutKind = "note" | "tip" | "warning";

/* Matched against the callout's opening text, after tags are stripped and
   a leading "(" is dropped. Anything unmatched is a note. */
const CALLOUT_RULES: [RegExp, CalloutKind][] = [
  [/^(warning|caution|important|heads up|careful)\b/i, "warning"],
  [/^[\s\S]{0,120}\b(permanent|permanently|cannot be undone|can't be undone)\b/i, "warning"],
  [/^(tip|pro tip|good to know|quick tip)\b/i, "tip"],
];

/**
 * Adds data-callout="note|tip|warning" to every <blockquote> in sanitised
 * article HTML, so help articles can style the "Note:" / "Important:" boxes
 * editors write as blockquotes. A pure string pass, so SSR and the client
 * produce the same markup. A blockquote that already carries data-callout
 * is left alone.
 */
export function tagCallouts(html: string): string {
  if (!html || !/<blockquote/i.test(html)) return html;
  return html.replace(
    /<blockquote(\s[^>]*)?>([\s\S]*?)<\/blockquote>/gi,
    (match, attrs: string | undefined, inner: string) => {
      if (attrs && /data-callout=/i.test(attrs)) return match;
      const text = inner.replace(/<[^>]+>/g, "").replace(/^[\s(]+/, "");
      const kind = CALLOUT_RULES.find(([pattern]) => pattern.test(text))?.[1] ?? "note";
      return `<blockquote${attrs ?? ""} data-callout="${kind}">${inner}</blockquote>`;
    }
  );
}
