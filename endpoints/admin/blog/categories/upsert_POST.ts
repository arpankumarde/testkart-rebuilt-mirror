import { schema, OutputType } from "./upsert_POST.schema";
import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { slugify } from "../../../../helpers/slugify";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ["super_admin", "admin", "manager"]);
    
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    
    const targetSlug = input.slug ? slugify(input.slug) : slugify(input.name);
    
    // Validate uniqueness
    let slugQuery = db.selectFrom("blogCategories").where("slug", "=", targetSlug).where("type", "=", input.type);
    if (input.id) {
      slugQuery = slugQuery.where("id", "!=", input.id);
    }
    const existing = await slugQuery.select("id").executeTakeFirst();
    if (existing) {
      throw new Error("Category with this slug already exists.");
    }
    
    let category;
    if (input.id) {
      category = await db
        .updateTable("blogCategories")
        .set({
          name: input.name,
          slug: targetSlug,
          type: input.type,
          description: input.description ?? null,
          icon: input.icon ?? null,
          sortOrder: input.sortOrder,
          updatedAt: new Date()
        })
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      category = await db
        .insertInto("blogCategories")
        .values({
          name: input.name,
          slug: targetSlug,
          type: input.type,
          description: input.description ?? null,
          icon: input.icon ?? null,
          sortOrder: input.sortOrder,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    return new Response(superjson.stringify({ success: true, category } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}