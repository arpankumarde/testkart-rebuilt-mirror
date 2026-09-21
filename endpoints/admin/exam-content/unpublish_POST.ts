import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./unpublish_POST.schema";
import superjson from "superjson";
import { mapExamContentRow, EXAM_CONTENT_SELECT_COLUMNS } from "../../../helpers/examContentMapper";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const existing = await db
      .selectFrom("examContentPages")
      .select("id")
      .where("examId", "=", input.examId)
      .where("pageType", "=", input.pageType)
      .executeTakeFirst();

    if (!existing) {
      return new Response(superjson.stringify({ error: "Nothing to unpublish." }), { status: 400 });
    }

    const updated = await db
      .updateTable("examContentPages")
      .set({
        status: "draft",
        publishedTitle: null,
        publishedSeoTitle: null,
        publishedSeoDescription: null,
        publishedDescription: null,
        publishedContent: null,
        publishedFaqItems: null,
        publishedAt: null,
      })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    const withReviewer = await db
      .selectFrom("examContentPages")
      .leftJoin("admins", "examContentPages.reviewedByAdminId", "admins.id")
      .leftJoin(
        "admins as readyForReviewAdmins",
        "examContentPages.readyForReviewByAdminId",
        "readyForReviewAdmins.id"
      )
      .select(EXAM_CONTENT_SELECT_COLUMNS)
      .where("examContentPages.id", "=", updated.id)
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({ page: mapExamContentRow(withReviewer) } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-content/unpublish_POST] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
