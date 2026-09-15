import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchHomepageDataServer } from "../helpers/fetchHomepageDataServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;

  try {
    await qc.prefetchQuery({
      queryKey: ["homepage", "data"],
      queryFn: () => fetchHomepageDataServer(),
    });
  } catch (error) {
    console.error("Error prefetching homepage data:", error);
  }

  return { maxAge: 300 }; // Cache for 5 minutes
};
