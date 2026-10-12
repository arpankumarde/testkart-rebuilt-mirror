import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchLiveTestDetailsServer } from "../helpers/fetchLiveTestDetailsServer";
import { isNotFoundError } from "../helpers/isNotFoundError";

export const prefetch: PagePrefetchFn = async ({ qc, url }) => {
  const liveTestIdStr = new URL(url).pathname.split("/").filter(Boolean).pop();
  const numericId = liveTestIdStr ? parseInt(liveTestIdStr, 10) : NaN;
  // The page treats a non-numeric id as a missing test, so the status matches.
  if (!numericId || isNaN(numericId)) return { statusCode: 404, maxAge: 300 };

  try {
    await qc.fetchQuery({
      queryKey: ["liveTest", numericId, "guest"],
      queryFn: () => fetchLiveTestDetailsServer(numericId),
    });
    return { maxAge: 300 };
  } catch (error) {
    if (isNotFoundError(error)) return { statusCode: 404, maxAge: 300 };
    console.error("Error prefetching live test details:", error);
    // Not cached, so a transient database failure is not served to every visitor for five minutes.
    return { maxAge: 0 };
  }
};