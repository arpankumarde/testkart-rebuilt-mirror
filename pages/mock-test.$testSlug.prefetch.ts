import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchTestDetailsServer } from "../helpers/fetchTestDetailsServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc, url } = ctx;
  
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    
    // Extract testName from the end of the path (e.g., /exam-name/test-name)
    const testName = pathSegments[pathSegments.length - 1];

    if (testName) {
      await qc.prefetchQuery({
        queryKey: ["tests", "details", testName],
        queryFn: () => fetchTestDetailsServer(testName),
      });
    }
  } catch (error) {
    console.error("Error prefetching test details:", error);
  }
  
  // Cache the page for 5 minutes
  return { maxAge: 300 };
};