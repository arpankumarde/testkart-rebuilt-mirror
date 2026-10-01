import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { customPageType } from "../../../../helpers/examContentTypes";

// Removes a custom page and its content (draft and live copy) together, so its
// public URL goes back to redirecting to the exam hub.
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const result = await db.transaction().execute(async (trx) => {
      const content = await trx
        .deleteFrom("examContentPages")
        .where("examId", "=", input.examId)
        .where("pageType", "=", customPageType(input.slug))
        .returning("status")
        .executeTakeFirst();
      const page = await trx
        .deleteFrom("examCustomPages")
        .where("examId", "=", input.examId)
        .where("slug", "=", input.slug)
        .returning("id")
        .executeTakeFirst();
      return { found: !!page, wasPublished: content?.status === "published" };
    });

    if (!result.found) {
      return new Response(superjson.stringify({ error: "That custom page no longer exists." }), {
        status: 404,
      });
    }

    return new Response(
      superjson.stringify({ success: true, wasPublished: result.wasPublished } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-content/custom-page/delete_POST] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}