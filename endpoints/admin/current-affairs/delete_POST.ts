import superjson from "superjson";
import { schema, OutputType } from "./delete_POST.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { currentAffairsServer } from "../../../helpers/currentAffairsServer";

/** Only drafts and archived posts can be deleted, so nothing live disappears in one click. */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const post = await db
      .selectFrom("currentAffairsPosts")
      .select(["id", "status"])
      .where("id", "=", input.id)
      .executeTakeFirst();
    if (!post) {
      return new Response(superjson.stringify({ error: "Current affairs post not found" }), { status: 404 });
    }
    if (post.status === "published" || post.status === "scheduled") {
      throw new Error("Unpublish or archive this post before deleting it");
    }

    await db.deleteFrom("currentAffairsPosts").where("id", "=", input.id).execute();
    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return currentAffairsServer.errorResponse(error, "Error deleting current affairs post");
  }
}