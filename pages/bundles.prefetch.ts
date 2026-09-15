import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchBundlesListServer } from "../helpers/fetchBundlesListServer";

const BUNDLES_PER_PAGE = 9;

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;

  try {
    // Must match the queryKey used by pages/bundles.tsx's default (page 1,
    // no search term) render so the marketplace-wide bundles listing is
    // server-rendered instead of client-only.
    await qc.prefetchQuery({
      queryKey: ["public", "bundles", "list", { page: 1, limit: BUNDLES_PER_PAGE }],
      queryFn: () => fetchBundlesListServer({ page: 1, limit: BUNDLES_PER_PAGE }),
    });
  } catch (error) {
    console.error("Error prefetching bundles list:", error);
  }

  return { maxAge: 300 };
};
