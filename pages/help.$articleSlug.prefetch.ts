import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchBlogPostDetailServer } from "../helpers/fetchBlogPostDetailServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc, url } = ctx;

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const slug = pathParts[pathParts.length - 1];

    if (slug) {
      await qc.prefetchQuery({
        queryKey: ["public", "blog", "post", slug],
        queryFn: () => fetchBlogPostDetailServer(slug),
      });
    }
  } catch (error) {
    console.error("Error prefetching knowledge base article:", error);
  }

  return { maxAge: 300 };
};