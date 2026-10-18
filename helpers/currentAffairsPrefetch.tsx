import type { PageServerContext, PrefetchResult } from "@floot/prefetch";
import { currentAffairsPublicServer } from "./currentAffairsPublicServer";
import { currentAffairsMeta, type ArchiveType } from "./currentAffairsMeta";

/*
 * SSR data for the Current Affairs hub and its archives. Query keys must match
 * currentAffairsPublicKeys.hub({}), .list({ type, page }) and .stories({ page }) in
 * helpers/useCurrentAffairsPublic. The daily views list stories; weekly and monthly list digests.
 */
export async function prefetchCurrentAffairsListing(ctx: PageServerContext, archive?: ArchiveType): Promise<PrefetchResult> {
  const { qc } = ctx;
  const url = new URL(ctx.url, "https://testkart.in");
  const lang = url.searchParams.get("lang");
  const page = archive ? Math.max(1, Math.floor(Number(url.searchParams.get("page"))) || 1) : 1;
  const topic = (archive ?? "daily") === "daily" ? url.searchParams.get("topic") || undefined : undefined;

  // The hub's old ?type= tabs moved to their own archive URLs: one 301 straight there.
  const legacyType = archive ? null : url.searchParams.get("type");
  if (legacyType && currentAffairsMeta.isArchiveType(legacyType)) {
    const oldPage = Math.max(1, Math.floor(Number(url.searchParams.get("page"))) || 1);
    const target = currentAffairsMeta.archivePath(legacyType, oldPage);
    const withLang = lang === "en" || lang === "hi" ? `${target}${target.includes("?") ? "&" : "?"}lang=${lang}` : target;
    return { redirect: { to: withLang, permanent: true } };
  }

  // Language-filtered views render on the client; the shared caches hold the unfiltered data.
  if (lang) return { maxAge: 300 };

  try {
    const type = archive ?? "daily";
    const [, main] = await Promise.all([
      qc.fetchQuery({ queryKey: ["current-affairs", "hub", "all"], queryFn: () => currentAffairsPublicServer.fetchHub() }),
      type === "daily"
        ? qc.fetchQuery({
            queryKey: ["current-affairs", "stories", { page, topic }],
            queryFn: () => currentAffairsPublicServer.fetchDailyStories({ page, topic }),
          })
        : qc.fetchQuery({
            queryKey: ["current-affairs", "list", { type, page }],
            queryFn: () => currentAffairsPublicServer.fetchList({ type, page }),
          }),
      type === "monthly" && page === 1
        ? Promise.resolve()
        : qc.prefetchQuery({
            queryKey: ["current-affairs", "list", { type: "monthly", page: 1 }],
            queryFn: () => currentAffairsPublicServer.fetchList({ type: "monthly", page: 1 }),
          }),
    ]);
    // A page past the end of the archive does not exist.
    if (archive && page > 1 && page > main.totalPages) return { statusCode: 404, maxAge: 300 };
  } catch (error) {
    console.error("Error prefetching current affairs:", error);
    return { maxAge: 60 };
  }
  return { maxAge: 300 };
}