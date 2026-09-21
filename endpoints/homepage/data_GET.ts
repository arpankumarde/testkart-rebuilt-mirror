import { OutputType } from "./data_GET.schema";
import superjson from "superjson";
import { homepageFetchTopMockTests } from "../../helpers/homepageFetchTopMockTests";
import { homepageFetchPopularCourses } from "../../helpers/homepageFetchPopularCourses";
import { homepageFetchFeaturedCourses } from "../../helpers/homepageFetchFeaturedCourses";
import { homepageFetchPopularNotes } from "../../helpers/homepageFetchPopularNotes";
import { homepageFetchLiveSpotlight } from "../../helpers/homepageFetchLiveSpotlight";
import { fetchPopularTeachers } from "../../helpers/homepageFetchPopularTeachers";

export async function handle(request: Request) {
  try {
    // Execute all section fetches in parallel
    const [
      topMockTests,
      popularCourses,
      featuredCourses,
      popularNotes,
      liveTestSpotlight,
      popularTeachers,
    ] = await Promise.all([
      homepageFetchTopMockTests().catch((e) => { console.error("Top mock tests fetch failed", e); return []; }),
      homepageFetchPopularCourses().catch((e) => { console.error("Popular courses fetch failed", e); return []; }),
      homepageFetchFeaturedCourses().catch((e) => { console.error("Featured courses fetch failed", e); return []; }),
      homepageFetchPopularNotes().catch((e) => { console.error("Popular notes fetch failed", e); return []; }),
      homepageFetchLiveSpotlight().catch((e) => { console.error("Live spotlight fetch failed", e); return []; }),
      fetchPopularTeachers().catch((e) => { console.error("Popular teachers fetch failed", e); return []; }),
    ]);

    return new Response(
      superjson.stringify({
        topMockTests,
        popularCourses,
        featuredCourses,
        popularNotes,
        liveTestSpotlight,
        popularTeachers,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to fetch homepage data:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch homepage data.", details: errorMessage }),
      { status: 500 }
    );
  }
}
