import type { PageServerContext, PrefetchResult } from "@floot/prefetch";
import { examNewsPublicServer } from "./examNewsPublicServer";
import { examNewsPublicMeta, type ListingScope } from "./examNewsPublicMeta";
import type { InputType as ListInput } from "../endpoints/exam-news/list_GET.schema";

const CACHE_SECONDS = 300;

const NOT_FOUND: PrefetchResult = { statusCode: 404, maxAge: CACHE_SECONDS };

const isReserved = (segment: string) => (examNewsPublicMeta.RESERVED_SLUGS as readonly string[]).includes(segment);

/** A request on an untidy URL (uppercase, double or trailing slash): one 301 to the clean one. */
function normalizeRedirect(url: URL): PrefetchResult | null {
  const clean = examNewsPublicMeta.normalizePath(url.pathname);
  return clean !== url.pathname ? { redirect: { to: `${clean}${url.search}`, permanent: true } } : null;
}

/** Seeds one listing page and the sidebar; 404s an unknown exam or a page past the end. */
async function prefetchList(ctx: PageServerContext, url: URL, scope: ListingScope, page: number): Promise<PrefetchResult> {
  const input: ListInput = { page };
  if (scope.type) input.type = scope.type;
  if (scope.examSlug) input.exam = scope.examSlug;
  const q = url.searchParams.get("q")?.trim();
  if (q) input.q = q;

  try {
    const [list] = await Promise.all([
      ctx.qc.fetchQuery({ queryKey: ["exam-news", "list", input], queryFn: () => examNewsPublicServer.fetchList(input) }),
      ctx.qc.prefetchQuery({ queryKey: ["exam-news", "sidebar"], queryFn: () => examNewsPublicServer.fetchSidebar() }),
    ]);
    if (scope.examSlug && !list.exam) return NOT_FOUND;
    if (page > list.totalPages) return NOT_FOUND;
  } catch (error) {
    console.error("Error prefetching exam news:", error);
    return { maxAge: 0 };
  }
  return { maxAge: CACHE_SECONDS };
}

/*
 * SSR for the Exam News listings: the hub, /type/{type} and /{exam-slug}, each with /page/{n}.
 * /exam-news/{exam-slug} itself is served by prefetchExamNewsStory, which shares its path with stories.
 * Query keys must match examNewsPublicKeys in helpers/useExamNewsPublic.
 */
export async function prefetchExamNewsListing(ctx: PageServerContext): Promise<PrefetchResult> {
  const url = new URL(ctx.url, "https://testkart.in");
  const redirect = normalizeRedirect(url);
  if (redirect) return redirect;

  // ["", "exam-news", ("type", type | "exam", exam-slug | exam-slug)?, ("page", n)?]
  const parts = url.pathname.split("/").slice(2);
  let scope: ListingScope = {};
  let rest = parts;
  let legacy = false;
  if (parts[0] === "type") {
    const type = examNewsPublicMeta.typeFromSegment(parts[1]);
    if (!type) return NOT_FOUND;
    scope = { type };
    rest = parts.slice(2);
  } else if (parts[0] === "exam") {
    scope = { examSlug: decodeURIComponent(parts[1] ?? "") };
    rest = parts.slice(2);
    legacy = true;
  } else if (parts[0] && parts[0] !== "page") {
    scope = { examSlug: decodeURIComponent(parts[0]) };
    rest = parts.slice(1);
  }
  if (rest.length > 0 && (rest[0] !== "page" || rest.length !== 2)) return NOT_FOUND;
  const page = examNewsPublicMeta.parsePage(rest[1]);
  if (page === null) return NOT_FOUND;
  if (scope.examSlug !== undefined && (!scope.examSlug || isReserved(scope.examSlug))) return NOT_FOUND;

  // An old /exam/{exam-slug} URL, or /page/1 of any listing: one 301 to the listing's own URL.
  if (legacy || (rest.length === 2 && page === 1)) {
    return { redirect: { to: `${examNewsPublicMeta.listingPath(scope, page)}${url.search}`, permanent: true } };
  }

  return prefetchList(ctx, url, scope, page);
}

/** /exam-news/{slug}: a story (current or earlier slug), else the exam with that slug, else 404. */
export async function prefetchExamNewsStory(ctx: PageServerContext): Promise<PrefetchResult> {
  const url = new URL(ctx.url, "https://testkart.in");
  const redirect = normalizeRedirect(url);
  if (redirect) return redirect;
  const slug = decodeURIComponent(url.pathname.split("/")[2] ?? "");
  if (!slug || isReserved(slug)) return NOT_FOUND;

  try {
    // null is cached on purpose: the client reads it as "not a story" and renders the exam listing.
    const story = await ctx.qc.fetchQuery({
      queryKey: ["exam-news", "details", slug],
      queryFn: () => examNewsPublicServer.fetchDetail(slug),
    });
    if (story) {
      // A renamed story: one 301 straight to its current URL.
      if (story.canonicalPath !== url.pathname) return { redirect: { to: story.canonicalPath, permanent: true } };
      return { maxAge: CACHE_SECONDS };
    }
  } catch (error) {
    console.error("Error prefetching exam news story:", error);
    return { maxAge: 0 };
  }

  return prefetchList(ctx, url, { examSlug: slug }, 1);
}
