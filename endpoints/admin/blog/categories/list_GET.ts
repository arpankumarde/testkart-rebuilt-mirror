import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    
    const categories = await db
      .selectFrom("blogCategories")
      .leftJoin("blogPosts", "blogPosts.categoryId", "blogCategories.id")
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
      .groupBy("blogCategories.id")
      .orderBy("blogCategories.sortOrder", "asc")
      .execute();

    const output: OutputType = {
      categories: categories.map((c) => ({
        ...c,
        postCount: Number(c.postCount),
      })),
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}