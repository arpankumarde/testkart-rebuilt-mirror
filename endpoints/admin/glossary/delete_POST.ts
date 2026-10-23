import superjson from "superjson";
import { schema, OutputType } from "./delete_POST.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { glossaryServer } from "../../../helpers/glossaryServer";

/** The foreign keys cascade, so the term also leaves the related list of every term that chose it. */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const deleted = await db.deleteFrom("glossaryTerms").where("id", "=", input.id).executeTakeFirst();
    if (Number(deleted.numDeletedRows) === 0) {
      return new Response(superjson.stringify({ error: "Glossary term not found" }), { status: 404 });
    }
    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return glossaryServer.errorResponse(error, "Error deleting glossary term");
  }
}