import type { PagePrefetchFn } from "@floot/prefetch";
import { currentAffairsPublicServer } from "../helpers/currentAffairsPublicServer";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  const url = new URL(ctx.url, "https://testkart.in");
  const [, , rawType = "", rawSlug = ""] = url.pathname.split("/");
  const type = rawType.toLowerCase();
  const slug = decodeURIComponent(rawSlug).toLowerCase();
  if (!currentAffairsMeta.isArchiveType(type) || !slug) return { statusCode: 404 };

  try {
    const result = await currentAffairsPublicServer.fetchArchiveDetail(type, slug);
    if (!result) return { statusCode: 404 };
    // Older period URLs, uppercase letters or a trailing slash: one 301 to the current URL.
    if (result.canonicalPath !== url.pathname) return { redirect: { to: `${result.canonicalPath}${url.search}`, permanent: true } };
    // Must match currentAffairsPublicKeys.details({ type, slug }) in helpers/useCurrentAffairsPublic.
    qc.setQueryData(["current-affairs", "details", `${type}/${slug}`], result);
    return { maxAge: 300 };
  } catch (error) {
    console.error("Error prefetching current affairs article:", error);
    return { maxAge: 60 };
  }
};
