import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchTestDetailsServer } from "../helpers/fetchTestDetailsServer";
import { isNotFoundError } from "../helpers/isNotFoundError";

export const prefetch: PagePrefetchFn = async ({ qc, url }) => {
  const testSlug = new URL(url).pathname.split("/").filter(Boolean).pop();
  if (!testSlug) return { statusCode: 404, maxAge: 300 };

  try {
    await qc.fetchQuery({
      queryKey: ["tests", "details", testSlug],
      queryFn: () => fetchTestDetailsServer(testSlug),
    });
    return { maxAge: 300 };
  } catch (error) {
    // Missing, deleted and unpublished series render NotFoundState; crawlers get a real 404.
    if (isNotFoundError(error)) return { statusCode: 404, maxAge: 300 };
    console.error("Error prefetching test details:", error);
    // Not cached, so a transient database failure is not served to every visitor for five minutes.
    return { maxAge: 0 };
  }
};