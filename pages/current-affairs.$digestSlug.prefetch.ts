import type { PagePrefetchFn } from "@floot/prefetch";
import { currentAffairsPublicServer } from "../helpers/currentAffairsPublicServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  const url = new URL(ctx.url, "https://testkart.in");
  const slug = decodeURIComponent(url.pathname.split("/")[2] ?? "");
  if (!slug) return { statusCode: 404 };

  try {
    const result = await currentAffairsPublicServer.fetchDetail(slug);
    if (!result) return { statusCode: 404 };
    // Dated digests moved to their period URL and renamed posts to their current slug: 301 straight there.
    if (result.canonicalPath !== url.pathname) return { redirect: { to: `${result.canonicalPath}${url.search}`, permanent: true } };
    // Must match currentAffairsPublicKeys.details({ slug }) in helpers/useCurrentAffairsPublic.
    qc.setQueryData(["current-affairs", "details", `slug:${slug}`], { post: result.post, canonicalPath: result.canonicalPath });
    return { maxAge: 300 };
  } catch (error) {
    console.error("Error prefetching current affairs digest:", error);
    return { maxAge: 60 };
  }
};