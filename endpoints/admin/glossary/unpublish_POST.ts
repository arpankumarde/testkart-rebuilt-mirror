import superjson from "superjson";
import { schema, OutputType } from "./unpublish_POST.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { glossaryServer } from "../../../helpers/glossaryServer";

/** Relations are kept: the term drops off every public page at once and comes back if it is republished. */
export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const updated = await db
      .updateTable("glossaryTerms")
      .set({ status: "draft", publishedAt: null, updatedBy: admin.id, updatedAt: new Date() })
      .where("id", "=", input.id)
      .executeTakeFirst();
    if (Number(updated.numUpdatedRows) === 0) {
      return new Response(superjson.stringify({ error: "Glossary term not found" }), { status: 404 });
    }
    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return glossaryServer.errorResponse(error, "Error unpublishing glossary term");
  }
}