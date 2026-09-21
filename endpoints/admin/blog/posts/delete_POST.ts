import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("blogPostTags").where("postId", "=", input.id).execute();
      await trx.deleteFrom("blogComments").where("postId", "=", input.id).execute();
      await trx.deleteFrom("blogPosts").where("id", "=", input.id).execute();
    });

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