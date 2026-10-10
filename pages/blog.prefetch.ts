import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchBlogCategoriesServer } from "../helpers/fetchBlogCategoriesServer";
import { fetchBlogPostsListServer } from "../helpers/fetchBlogPostsListServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  try {
    await qc.prefetchQuery({
      queryKey: ["public", "blog", "categories", { type: "blog" }],
      queryFn: () => fetchBlogCategoriesServer({ type: "blog" }),
    });
    // Must match useBlogPostsInfiniteQuery's key for the unfiltered list.
    await qc.prefetchInfiniteQuery({
      queryKey: ["public", "blog", "posts", "infinite", { type: "blog", limit: 12 }],
      queryFn: ({ pageParam }) => fetchBlogPostsListServer({ type: "blog", page: pageParam as number, limit: 12 }),
      initialPageParam: 1,
    });
  } catch (error) {
    console.error("Error prefetching blog list:", error);
  }
  return { maxAge: 300 };
};
