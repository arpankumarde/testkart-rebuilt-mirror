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
    await qc.prefetchQuery({
      queryKey: ["public", "blog", "posts", { type: "blog", page: 1, limit: 12 }],
      queryFn: () => fetchBlogPostsListServer({ type: "blog", page: 1, limit: 12 }),
    });
  } catch (error) {
    console.error("Error prefetching blog list:", error);
  }
  return { maxAge: 300 };
};
