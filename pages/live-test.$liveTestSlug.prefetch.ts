import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchLiveTestDetailsServer } from "../helpers/fetchLiveTestDetailsServer";
import { liveTestDetailsBySlugQueryKey } from "../helpers/liveTestQueryKeys";
import { isNotFoundError } from "../helpers/isNotFoundError";

export const prefetch: PagePrefetchFn = async ({ qc, url }) => {
  const segment = new URL(url).pathname.split("/").filter(Boolean).pop();
  const slug = segment ? decodeURIComponent(segment) : "";
  if (!slug) return { statusCode: 404, maxAge: 300 };

  try {
    await qc.fetchQuery({
      queryKey: liveTestDetailsBySlugQueryKey(slug, "guest"),
      queryFn: () => fetchLiveTestDetailsServer({ slug }),
    });
    return { maxAge: 300 };
  } catch (error) {
    if (isNotFoundError(error)) return { statusCode: 404, maxAge: 300 };
    console.error("Error prefetching live test details:", error);
    // Not cached, so a transient database failure is not served to every visitor for five minutes.
    return { maxAge: 0 };
  }
};
