import type { PagePrefetchFn } from "@floot/prefetch";
import { currentAffairsPublicServer } from "../helpers/currentAffairsPublicServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  try {
    // Must match currentAffairsPublicKeys.hub({}) in helpers/useCurrentAffairsPublic.
    await qc.prefetchQuery({
      queryKey: ["current-affairs", "hub", "all"],
      queryFn: () => currentAffairsPublicServer.fetchHub(),
    });
  } catch (error) {
    console.error("Error prefetching current affairs hub:", error);
  }
  return { maxAge: 300 };
};