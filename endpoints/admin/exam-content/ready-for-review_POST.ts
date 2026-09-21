import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./ready-for-review_POST.schema";
import superjson from "superjson";
import { mapExamContentRow, EXAM_CONTENT_SELECT_COLUMNS } from "../../../helpers/examContentMapper";

// Marks the saved draft ready for review, or clears the mark. Status, the live
// copy and updatedAt are left alone: the editor re-syncs its form whenever
// updatedAt changes, which would throw away unsaved edits. Publishing clears
// the mark.
export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const existing = await db
      .selectFrom("examContentPages")
      .select(["id", "content", "faqItems"])
      .where("examId", "=", input.examId)
      .where("pageType", "=", input.pageType)
      .executeTakeFirst();

    if (!existing) {
      return new Response(
        superjson.stringify({ error: "Save a draft before marking it ready for review." }),
        { status: 400 }
      );
    }

    const hasContent =
      (!!existing.content && existing.content.trim().length > 0) ||
      (Array.isArray(existing.faqItems) && existing.faqItems.length > 0);

    if (input.readyForReview && !hasContent) {
      return new Response(
        superjson.stringify({ error: "The saved draft has no content or FAQs to review yet." }),
        { status: 400 }
      );
    }

    await db
      .updateTable("examContentPages")
      .set({
        readyForReviewAt: input.readyForReview ? new Date() : null,
        readyForReviewByAdminId: input.readyForReview ? admin.id : null,
      })
      .where("id", "=", existing.id)
      .execute();

    const withAdmins = await db
      .selectFrom("examContentPages")
      .leftJoin("admins", "examContentPages.reviewedByAdminId", "admins.id")
      .leftJoin(
        "admins as readyForReviewAdmins",
        "examContentPages.readyForReviewByAdminId",
        "readyForReviewAdmins.id"
      )
      .select(EXAM_CONTENT_SELECT_COLUMNS)
      .where("examContentPages.id", "=", existing.id)
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({ page: mapExamContentRow(withAdmins) } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-content/ready-for-review_POST] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}