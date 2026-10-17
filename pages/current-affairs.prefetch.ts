import type { PagePrefetchFn } from "@floot/prefetch";
import { currentAffairsPublicServer } from "../helpers/currentAffairsPublicServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  try {
    // Keys must match currentAffairsPublicKeys.hub({}) and .feed({ type }) in helpers/useCurrentAffairsPublic.
    await Promise.all([
      qc.prefetchQuery({
        queryKey: ["current-affairs", "hub", "all"],
        queryFn: () => currentAffairsPublicServer.fetchHub(),
      }),
      ...(["daily", "monthly"] as const).map((type) =>
        qc.prefetchInfiniteQuery({
          queryKey: ["current-affairs", "feed", type, "all"],
          queryFn: () => currentAffairsPublicServer.fetchList({ type, page: 1 }),
          initialPageParam: 1,
        })
      ),
    ]);
  } catch (error) {
    console.error("Error prefetching current affairs:", error);
  }
  return { maxAge: 300 };
};
