import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchCourseDetailsServer } from "../helpers/fetchCourseDetailsServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc, url } = ctx;
  
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    
    // Extract courseSlug from the end of the path (e.g., /course/course-slug)
    const courseSlug = pathSegments[pathSegments.length - 1];

    if (courseSlug) {
      await qc.prefetchQuery({
        queryKey: ["public", "courses", "details", courseSlug],
        queryFn: () => fetchCourseDetailsServer(courseSlug),
      });
    }
  } catch (error) {
    console.error("Error prefetching course details:", error);
  }
  
  // Cache the page for 5 minutes
  return { maxAge: 300 };
};