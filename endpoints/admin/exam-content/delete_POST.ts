import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";

// Removes the section row outright - draft and published snapshot together. Unpublish is the
// reversible alternative: it keeps the draft and only takes the section off the public site.
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const deleted = await db
      .deleteFrom("examContentPages")
      .where("examId", "=", input.examId)
      .where("pageType", "=", input.pageType)
      .returning(["id", "status"])
      .executeTakeFirst();

    if (!deleted) {
      return new Response(
        superjson.stringify({ error: "No content exists for that exam and section." }),
        { status: 404 }
      );
    }

    return new Response(
      superjson.stringify({
        success: true,
        deleted: {
          id: deleted.id,
          examId: input.examId,
          pageType: input.pageType,
          wasPublished: deleted.status === "published",
        },
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-content/delete_POST] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}