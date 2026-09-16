import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchTeacherProfileServer } from "../helpers/fetchTeacherProfileServer";
import { swmgPromoContent } from "../helpers/swmgPromoContent";

export const prefetch: PagePrefetchFn = async ({ qc }) => {
  const slug = swmgPromoContent.teacherSlug;
  try {
    // Same queryKey as useTeacherPublicProfileQuery, so his catalogue is in the served HTML.
    await qc.fetchQuery({ queryKey: ["teacherProfile", slug], queryFn: () => fetchTeacherProfileServer(slug) });
    return { maxAge: 300 };
  } catch (error) {
    console.error("Error prefetching the SWMG overview page:", error);
    return { maxAge: 0 };
  }
};