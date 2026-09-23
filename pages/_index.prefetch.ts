import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchHomepageDataServer } from "../helpers/fetchHomepageDataServer";
import { fetchTeacherProfileServer } from "../helpers/fetchTeacherProfileServer";
import { swmgPromoContent } from "../helpers/swmgPromoContent";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  const spotlightSlug = swmgPromoContent.teacherSlug;

  await Promise.all([
    qc
      .prefetchQuery({
        queryKey: ["homepage", "data"],
        queryFn: () => fetchHomepageDataServer(),
      })
      .catch((error) => console.error("Error prefetching homepage data:", error)),
    // Same queryKey as useTeacherPublicProfileQuery, so the UGC NET spotlight is in the served HTML.
    qc
      .prefetchQuery({
        queryKey: ["teacherProfile", spotlightSlug],
        queryFn: () => fetchTeacherProfileServer(spotlightSlug),
      })
      .catch((error) => console.error("Error prefetching the UGC NET spotlight:", error)),
  ]);

  return { maxAge: 300 }; // Cache for 5 minutes
};
