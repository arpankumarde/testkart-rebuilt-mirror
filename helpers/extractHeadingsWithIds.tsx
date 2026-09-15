import { slugify } from "./slugify";

export interface ExtractedHeading {
  id: string;
  text: string;
  level: number;
}

export interface HeadingExtractionResult {
  html: string;
  headings: ExtractedHeading[];
}

/**
 * Injects stable, unique `id` attributes onto every <h2>/<h3> in the given
 * (already-sanitized) HTML string and returns both the rewritten HTML and
 * the extracted heading list. Used to build a clickable table of contents
 * for blog and knowledge base articles.
 *
 * This is a pure string transform (no DOM APIs), so it produces identical
 * output on the server and the client for the same input — the ids are
 * baked into the markup itself instead of being assigned imperatively
 * after mount. An earlier version assigned `el.id` from a `useEffect` that
 * ran `querySelectorAll('h2, h3')` on the rendered article once — that
 * worked in isolation, but the assigned ids were not part of React's
 * render output, so anything that caused the article subtree to be
 * (re)committed (e.g. the query-hydration → background refetch cycle that
 * always follows an SSR-prefetched page load) silently dropped them,
 * leaving every TOC link pointing at a `#heading-N` id that didn't exist
 * anywhere in the DOM — which is why clicking a TOC entry did nothing.
 */
export function extractHeadingsWithIds(html: string): HeadingExtractionResult {
  const headings: ExtractedHeading[] = [];
  let counter = 0;

  const withIds = html.replace(
    /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi,
    (_match, tagRaw: string, attrs: string, inner: string) => {
      const tag = tagRaw.toLowerCase();
      const level = tag === "h2" ? 2 : 3;
      const text = inner.replace(/<[^>]+>/g, "").trim();
      const baseSlug = slugify(text) || "section";
      const id = `${baseSlug}-${counter}`;
      counter += 1;

      headings.push({ id, text, level });

      // Strip any pre-existing id attribute so ours always wins, then add it.
      const cleanedAttrs = attrs.replace(/\s+id="[^"]*"/i, "");
      return `<${tag}${cleanedAttrs} id="${id}">${inner}</${tag}>`;
    }
  );

  return { html: withIds, headings };
}
