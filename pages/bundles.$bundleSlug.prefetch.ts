import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchBundleDetailsServer } from "../helpers/fetchBundleDetailsServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc, url } = ctx;
  
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    
    // Extract bundleSlug from the end of the path
    const bundleSlug = pathSegments[pathSegments.length - 1];

    if (bundleSlug) {
      await qc.prefetchQuery({
        queryKey: ["public", "bundles", "details", bundleSlug],
        queryFn: () => fetchBundleDetailsServer(bundleSlug),
      });
    }
  } catch (error) {
    console.error("Error prefetching bundle details:", error);
  }
  
  return { maxAge: 300 };
};