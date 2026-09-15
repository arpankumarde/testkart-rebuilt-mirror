import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchLiveTestDetailsServer } from "../helpers/fetchLiveTestDetailsServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc, url } = ctx;
  
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    
    // Extract liveTestId from the end of the path
    const liveTestIdStr = pathSegments[pathSegments.length - 1];
    const numericId = liveTestIdStr ? parseInt(liveTestIdStr, 10) : undefined;

    if (numericId && !isNaN(numericId)) {
      await qc.prefetchQuery({
        queryKey: ["liveTest", numericId, "guest"],
        queryFn: () => fetchLiveTestDetailsServer(numericId),
      });
    }
  } catch (error) {
    console.error("Error prefetching live test details:", error);
  }
  
  return { maxAge: 300 };
};