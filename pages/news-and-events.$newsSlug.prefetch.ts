import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchNewsDetailServer } from "../helpers/fetchNewsDetailServer";

/*
 * Old /news-and-events/:slug links (shares, press mentions, search results)
 * move to /press/:slug in one 301, landing on the current slug when the
 * requested one was renamed. The query string (utm tags) is kept.
 */
export const prefetch: PagePrefetchFn = async ({ url }) => {
  const parsed = new URL(url, "https://testkart.in");
  const segment = parsed.pathname.split("/").filter(Boolean).pop();
  if (!segment) return { redirect: { to: `/press${parsed.search}`, permanent: true } };

  const requested = decodeURIComponent(segment);
  let slug = requested;
  try {
    slug = (await fetchNewsDetailServer(requested)).item.slug;
  } catch {
    // Unknown or unpublished: /press/:slug answers with its own 404.
  }
  return { redirect: { to: `/press/${encodeURIComponent(slug)}${parsed.search}`, permanent: true } };
};