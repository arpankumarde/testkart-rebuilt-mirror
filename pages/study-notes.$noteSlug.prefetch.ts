import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchShopProductDetailsServer } from "../helpers/fetchShopProductDetailsServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc, url } = ctx;
  
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    
    // Extract noteSlug from the end of the path
    const noteSlug = pathSegments[pathSegments.length - 1];

    if (noteSlug) {
      await qc.prefetchQuery({
        queryKey: ["shop", "product", noteSlug],
        queryFn: () => fetchShopProductDetailsServer(noteSlug),
      });
    }
  } catch (error) {
    console.error("Error prefetching shop product details:", error);
  }
  
  // Cache the page for 5 minutes
  return { maxAge: 300 };
};