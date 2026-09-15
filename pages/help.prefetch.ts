import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchBlogCategoriesServer } from "../helpers/fetchBlogCategoriesServer";
import { fetchBlogPostsListServer } from "../helpers/fetchBlogPostsListServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  try {
    await qc.prefetchQuery({
      queryKey: ["public", "blog", "categories", { type: "knowledge_base" }],
      queryFn: () => fetchBlogCategoriesServer({ type: "knowledge_base" }),
    });
    await qc.prefetchQuery({
      queryKey: ["public", "blog", "posts", { type: "knowledge_base", page: 1, limit: 100 }],
      queryFn: () => fetchBlogPostsListServer({ type: "knowledge_base", page: 1, limit: 100 }),
    });
  } catch (error) {
    console.error("Error prefetching knowledge base list:", error);
  }
  return { maxAge: 300 };
};
