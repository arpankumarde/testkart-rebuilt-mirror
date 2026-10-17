import superjson from "superjson";
import { schema, OutputType } from "./delete_POST.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { examNewsServer } from "../../../helpers/examNewsServer";

/** Only drafts and archived stories can be deleted, so nothing live disappears in one click. */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const post = await db.selectFrom("examNewsPosts").select(["id", "status"]).where("id", "=", input.id).executeTakeFirst();
    if (!post) {
      return new Response(superjson.stringify({ error: "News story not found" }), { status: 404 });
    }
    if (post.status === "published" || post.status === "scheduled") {
      throw new Error("Unpublish or archive this story before deleting it");
    }

    await db.deleteFrom("examNewsPosts").where("id", "=", input.id).execute();
    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return examNewsServer.errorResponse(error, "Error deleting exam news story");
  }
}