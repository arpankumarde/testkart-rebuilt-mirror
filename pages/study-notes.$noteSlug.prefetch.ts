import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchShopProductDetailsServer } from "../helpers/fetchShopProductDetailsServer";
import { isNotFoundError } from "../helpers/isNotFoundError";

export const prefetch: PagePrefetchFn = async ({ qc, url }) => {
  const noteSlug = new URL(url).pathname.split("/").filter(Boolean).pop();
  if (!noteSlug) return { statusCode: 404, maxAge: 300 };

  try {
    await qc.fetchQuery({
      queryKey: ["shop", "product", noteSlug],
      queryFn: () => fetchShopProductDetailsServer(noteSlug),
    });
    return { maxAge: 300 };
  } catch (error) {
    // Missing, deleted and unpublished notes render NotFoundState; crawlers get a real 404.
    if (isNotFoundError(error)) return { statusCode: 404, maxAge: 300 };
    console.error("Error prefetching shop product details:", error);
    // Not cached, so a transient database failure is not served to every visitor for five minutes.
    return { maxAge: 0 };
  }
};