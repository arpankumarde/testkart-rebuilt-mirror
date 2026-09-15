import type { OutputType } from "../endpoints/homepage/data_GET.schema";
import { homepageFetchTopMockTests } from "./homepageFetchTopMockTests";
import { homepageFetchPopularCourses } from "./homepageFetchPopularCourses";
import { homepageFetchPopularNotes } from "./homepageFetchPopularNotes";
import { homepageFetchLiveSpotlight } from "./homepageFetchLiveSpotlight";
import { fetchPopularTeachers } from "./homepageFetchPopularTeachers";

/**
 * Direct-DB counterpart to endpoints/homepage/data_GET.ts, for use ONLY from
 * page prefetch (pages/_index.prefetch.ts) — see
 * helpers/fetchBlogPostDetailServer.tsx for why the network endpoint can't
 * be called from within the SSR pass. The underlying section helpers here
 * already queried the DB directly (the endpoint was just a thin wrapper
 * around them), so this mirrors that same Promise.all. Keep in sync with
 * endpoints/homepage/data_GET.ts.
 */
export async function fetchHomepageDataServer(): Promise<OutputType> {
  const [topMockTests, popularCourses, popularNotes, liveTestSpotlight, popularTeachers] =
    await Promise.all([
      homepageFetchTopMockTests().catch((e) => { console.error("Top mock tests fetch failed", e); return []; }),
      homepageFetchPopularCourses().catch((e) => { console.error("Popular courses fetch failed", e); return []; }),
      homepageFetchPopularNotes().catch((e) => { console.error("Popular notes fetch failed", e); return []; }),
      homepageFetchLiveSpotlight().catch((e) => { console.error("Live spotlight fetch failed", e); return []; }),
      fetchPopularTeachers().catch((e) => { console.error("Popular teachers fetch failed", e); return []; }),
    ]);

  return {
    topMockTests,
    popularCourses,
    popularNotes,
    liveTestSpotlight,
    popularTeachers,
  };
}
