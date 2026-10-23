import type { PageServerContext, PrefetchResult } from "@floot/prefetch";
import { examNewsPublicMeta } from "./examNewsPublicMeta";
import { glossaryPublicServer } from "./glossaryPublicServer";

const CACHE_SECONDS = 300;

function normalizeRedirect(url: URL): PrefetchResult | null {
  const clean = examNewsPublicMeta.normalizePath(url.pathname);
  return clean !== url.pathname ? { redirect: { to: `${clean}${url.search}`, permanent: true } } : null;
}

/* Query keys must match glossaryPublicKeys in helpers/useGlossaryPublic. */
export async function prefetchGlossaryHub(ctx: PageServerContext): Promise<PrefetchResult> {
  const redirect = normalizeRedirect(new URL(ctx.url, "https://testkart.in"));
  if (redirect) return redirect;

  try {
    await ctx.qc.fetchQuery({
      queryKey: ["glossary", "list"],
      queryFn: async () => ({ terms: await glossaryPublicServer.fetchTerms() }),
    });
    return { maxAge: CACHE_SECONDS };
  } catch (error) {
    console.error("Error prefetching the glossary:", error);
    return { maxAge: 0 };
  }
}

export async function prefetchGlossaryTerm(ctx: PageServerContext): Promise<PrefetchResult> {
  const url = new URL(ctx.url, "https://testkart.in");
  const redirect = normalizeRedirect(url);
  if (redirect) return redirect;
  const slug = decodeURIComponent(url.pathname.split("/")[2] ?? "");
  if (!slug) return { statusCode: 404, maxAge: CACHE_SECONDS };

  try {
    const result = await ctx.qc.fetchQuery({
      queryKey: ["glossary", "details", slug],
      queryFn: async () => {
        const detail = await glossaryPublicServer.fetchDetail(slug);
        // Thrown rather than cached, so the client never hydrates an empty term.
        if (!detail) throw new Error("Term not found");
        return detail;
      },
    });
    // A renamed term: one 301 straight to its current URL.
    if (result.canonicalPath !== url.pathname) return { redirect: { to: result.canonicalPath, permanent: true } };
    return { maxAge: CACHE_SECONDS };
  } catch (error) {
    if (/not found/i.test(String(error))) return { statusCode: 404, maxAge: CACHE_SECONDS };
    console.error("Error prefetching glossary term:", error);
    return { maxAge: 0 };
  }
}