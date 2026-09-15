import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchCareersListServer } from "../helpers/fetchCareersListServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  try {
    await qc.prefetchQuery({
      queryKey: ["careers", "list"],
      queryFn: () => fetchCareersListServer(),
    });
  } catch (error) {
    console.error("Error prefetching careers list:", error);
  }

  return { maxAge: 300 }; // Cache for 5 minutes
};
