import type { PageServerContext, PrefetchResult } from "@floot/prefetch";
import { examNewsPublicServer } from "./examNewsPublicServer";
import { examNewsPublicMeta } from "./examNewsPublicMeta";
import type { InputType as ListInput } from "../endpoints/exam-news/list_GET.schema";

const CACHE_SECONDS = 300;

/** A request on an untidy URL (uppercase, double or trailing slash): one 301 to the clean one. */
function normalizeRedirect(url: URL): PrefetchResult | null {
  const clean = examNewsPublicMeta.normalizePath(url.pathname);
  return clean !== url.pathname ? { redirect: { to: `${clean}${url.search}`, permanent: true } } : null;
}

/*
 * SSR for every Exam News listing: the hub, /type/{type}, /exam/{exam-slug}, each with /page/{n}.
 * Query keys must match examNewsPublicKeys in helpers/useExamNewsPublic.
 */
export async function prefetchExamNewsListing(ctx: PageServerContext): Promise<PrefetchResult> {
  const url = new URL(ctx.url, "https://testkart.in");
  const redirect = normalizeRedirect(url);
  if (redirect) return redirect;

  // ["", "exam-news", ("type" | "exam", value)?, ("page", n)?]
  const parts = url.pathname.split("/").slice(2);
  let scopeKind: string | undefined;
  let scopeValue: string | undefined;
  if (parts[0] === "type" || parts[0] === "exam") [scopeKind, scopeValue] = [parts[0], decodeURIComponent(parts[1] ?? "")];
  const pageParts = scopeKind ? parts.slice(2) : parts;
  if (pageParts.length > 0 && (pageParts[0] !== "page" || pageParts.length !== 2)) return { statusCode: 404, maxAge: CACHE_SECONDS };
  const page = examNewsPublicMeta.parsePage(pageParts[1]);
  if (page === null) return { statusCode: 404, maxAge: CACHE_SECONDS };

  const type = scopeKind === "type" ? examNewsPublicMeta.typeFromSegment(scopeValue) : null;
  if (scopeKind === "type" && !type) return { statusCode: 404, maxAge: CACHE_SECONDS };
  const examSlug = scopeKind === "exam" ? scopeValue : undefined;

  // /page/1 is the listing itself.
  if (pageParts.length === 2 && page === 1) {
    const target = examNewsPublicMeta.listingPath({ type: type ?? undefined, examSlug });
    return { redirect: { to: `${target}${url.search}`, permanent: true } };
  }

  const input: ListInput = { page };
  if (type) input.type = type;
  if (examSlug) input.exam = examSlug;
  const q = url.searchParams.get("q")?.trim();
  if (q) input.q = q;

  try {
    const [list] = await Promise.all([
      ctx.qc.fetchQuery({ queryKey: ["exam-news", "list", input], queryFn: () => examNewsPublicServer.fetchList(input) }),
      ctx.qc.prefetchQuery({ queryKey: ["exam-news", "sidebar"], queryFn: () => examNewsPublicServer.fetchSidebar() }),
    ]);
    if (examSlug && !list.exam) return { statusCode: 404, maxAge: CACHE_SECONDS };
    // A page past the end of the listing does not exist.
    if (page > list.totalPages) return { statusCode: 404, maxAge: CACHE_SECONDS };
  } catch (error) {
    console.error("Error prefetching exam news:", error);
    return { maxAge: 0 };
  }
  return { maxAge: CACHE_SECONDS };
}

export async function prefetchExamNewsStory(ctx: PageServerContext): Promise<PrefetchResult> {
  const url = new URL(ctx.url, "https://testkart.in");
  const redirect = normalizeRedirect(url);
  if (redirect) return redirect;
  const slug = decodeURIComponent(url.pathname.split("/")[2] ?? "");
  if (!slug || (examNewsPublicMeta.RESERVED_SLUGS as readonly string[]).includes(slug)) {
    return { statusCode: 404, maxAge: CACHE_SECONDS };
  }

  try {
    const result = await ctx.qc.fetchQuery({
      queryKey: ["exam-news", "details", slug],
      queryFn: async () => {
        const detail = await examNewsPublicServer.fetchDetail(slug);
        // Thrown rather than cached, so the client never hydrates an empty story.
        if (!detail) throw new Error("Story not found");
        return detail;
      },
    });
    // A renamed story: one 301 straight to its current URL.
    if (result.canonicalPath !== url.pathname) return { redirect: { to: result.canonicalPath, permanent: true } };
    return { maxAge: CACHE_SECONDS };
  } catch (error) {
    if (/not found/i.test(String(error))) return { statusCode: 404, maxAge: CACHE_SECONDS };
    console.error("Error prefetching exam news story:", error);
    return { maxAge: 0 };
  }
}