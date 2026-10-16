import type { PagePrefetchFn } from "@floot/prefetch";
import { currentAffairsPublicServer } from "../helpers/currentAffairsPublicServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  const slug = (ctx as any).params?.digestSlug as string | undefined;
  if (!slug) return { statusCode: 404 };

  try {
    const result = await currentAffairsPublicServer.fetchDetail(slug);
    if (!result) return { statusCode: 404 };
    // A renamed digest answers on its retired slug; send readers and crawlers to the current one.
    if (result.canonicalSlug !== slug) return { redirect: { to: `/current-affairs/${result.canonicalSlug}` } };
    // Must match currentAffairsPublicKeys.details(slug) in helpers/useCurrentAffairsPublic.
    qc.setQueryData(["current-affairs", "details", slug], { post: result.post });
    return { maxAge: 300 };
  } catch (error) {
    console.error("Error prefetching current affairs digest:", error);
    return { maxAge: 60 };
  }
};