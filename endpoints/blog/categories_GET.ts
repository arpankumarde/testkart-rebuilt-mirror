import { schema, OutputType } from "./categories_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type");
    const input = schema.parse({ type: typeParam || undefined });
    
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