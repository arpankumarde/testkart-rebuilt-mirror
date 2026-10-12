import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchCourseDetailsServer } from "../helpers/fetchCourseDetailsServer";
import { isNotFoundError } from "../helpers/isNotFoundError";

export const prefetch: PagePrefetchFn = async ({ qc, url }) => {
  const courseSlug = new URL(url).pathname.split("/").filter(Boolean).pop();
  if (!courseSlug) return { statusCode: 404, maxAge: 300 };

  try {
    await qc.fetchQuery({
      queryKey: ["public", "courses", "details", courseSlug],
      queryFn: () => fetchCourseDetailsServer(courseSlug),
    });
    return { maxAge: 300 };
  } catch (error) {
    // Missing, deleted and unpublished courses render NotFoundState; crawlers get a real 404.
    if (isNotFoundError(error)) return { statusCode: 404, maxAge: 300 };
    console.error("Error prefetching course details:", error);
    // Not cached, so a transient database failure is not served to every visitor for five minutes.
    return { maxAge: 0 };
  }
};