import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ["super_admin", "admin", "manager"]);
    
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    
    // First, set categoryId to null for all posts with this category to safely detach without throwing constraint errors
    await db.updateTable("blogPosts")
      .set({ categoryId: null })
      .where("categoryId", "=", input.id)
      .execute();
      
    await db.deleteFrom("blogCategories").where("id", "=", input.id).execute();

    return new Response(superjson.stringify({ success: true } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}