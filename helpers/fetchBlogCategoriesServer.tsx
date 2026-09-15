import { db } from "./db";
import type { InputType, OutputType } from "../endpoints/blog/categories_GET.schema";

/**
 * Direct-DB counterpart to endpoints/blog/categories_GET.ts, for use ONLY
 * from page prefetch (pages/blog.prefetch.ts and pages/help.prefetch.ts) —
 * see helpers/fetchBlogPostDetailServer.tsx for why the network endpoint
 * can't be called from within the SSR pass. Keep in sync with
 * endpoints/blog/categories_GET.ts.
 */
export async function fetchBlogCategoriesServer(input: InputType): Promise<OutputType> {
  const categories = await db
    .selectFrom("blogCategories")
    .leftJoin("blogPosts", (join) =>
      join
        .onRef("blogPosts.categoryId", "=", "blogCategories.id")
        .on("blogPosts.status", "=", "published")
    )
    .select((eb) => [
      "blogCategories.id",
      "blogCategories.name",
      "blogCategories.slug",
      "blogCategories.type",
      "blogCategories.description",
      "blogCategories.icon",
      "blogCategories.sortOrder",
      "blogCategories.createdAt",
      "blogCategories.updatedAt",
      eb.fn.count<string | number>("blogPosts.id").as("postCount"),
    ])
    .where("blogCategories.type", "=", input.type)
    .groupBy("blogCategories.id")
    .orderBy("blogCategories.sortOrder", "asc")
    .execute();

  return {
    categories: categories.map((c) => ({
      ...c,
      postCount: Number(c.postCount),
    })),
  };
}
