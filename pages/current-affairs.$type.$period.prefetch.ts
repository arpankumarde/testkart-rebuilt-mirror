import type { PagePrefetchFn } from "@floot/prefetch";
import { currentAffairsPublicServer } from "../helpers/currentAffairsPublicServer";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  const url = new URL(ctx.url, "https://testkart.in");
  const [, , rawType = "", rawPeriod = ""] = url.pathname.split("/");
  const type = rawType.toLowerCase();
  const period = decodeURIComponent(rawPeriod).toLowerCase();
  if (!currentAffairsMeta.isArchiveType(type) || !currentAffairsMeta.periodFromSegment(type, period)) return { statusCode: 404 };

  try {
    const result = await currentAffairsPublicServer.fetchDetailByPeriod(type, period);
    if (!result) return { statusCode: 404 };
    // Uppercase letters or a trailing slash: one 301 to the clean lowercase URL.
    if (result.canonicalPath !== url.pathname) return { redirect: { to: `${result.canonicalPath}${url.search}`, permanent: true } };
    // Must match currentAffairsPublicKeys.details({ type, period }) in helpers/useCurrentAffairsPublic.
    qc.setQueryData(["current-affairs", "details", `${type}/${period}`], { post: result.post, canonicalPath: result.canonicalPath });
    return { maxAge: 300 };
  } catch (error) {
    console.error("Error prefetching current affairs digest:", error);
    return { maxAge: 60 };
  }
};