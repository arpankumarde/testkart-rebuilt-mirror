import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./upsert_POST.schema";
import superjson from "superjson";
import { mapExamContentRow, EXAM_CONTENT_SELECT_COLUMNS } from "../../../helpers/examContentMapper";
import { setExamOwnerToEditor } from "../../../helpers/examOwner";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request, ["super_admin", "admin", "manager"]);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const exam = await db
      .selectFrom("exams")
      .select("id")
      .where("id", "=", input.examId)
      .executeTakeFirst();
    if (!exam) {
      return new Response(superjson.stringify({ error: "Exam not found." }), { status: 404 });
    }

    // Manual edits are saved as a draft (or keep whatever status the row
    // already has — editing a published page doesn't silently republish it
    // with unreviewed changes; the admin has to hit Publish again). We only
    // reset status to "draft" here for brand-new rows.
    const saved = await db.transaction().execute(async (trx) => {
      const row = await trx
        .insertInto("examContentPages")
        .values({
          examId: input.examId,
          pageType: input.pageType,
          title: input.title,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          description: input.description ?? null,
          content: input.content ?? null,
          faqItems: (input.faqItems ?? null) as any,
          source: "manual",
          status: "draft",
        })
        .onConflict((oc) =>
          oc.columns(["examId", "pageType"]).doUpdateSet({
            title: input.title,
            seoTitle: input.seoTitle ?? null,
            seoDescription: input.seoDescription ?? null,
            description: input.description ?? null,
            content: input.content ?? null,
            faqItems: (input.faqItems ?? null) as any,
            source: "manual",
            updatedAt: new Date(),
          })
        )
        .returningAll()
        .executeTakeFirstOrThrow();
      await setExamOwnerToEditor(trx, input.examId, admin.id);
      return row;
    });

    const withReviewer = await db
      .selectFrom("examContentPages")
      .leftJoin("admins", "examContentPages.reviewedByAdminId", "admins.id")
      .leftJoin(
        "admins as readyForReviewAdmins",
        "examContentPages.readyForReviewByAdminId",
        "readyForReviewAdmins.id"
      )
      .select(EXAM_CONTENT_SELECT_COLUMNS)
      .where("examContentPages.id", "=", saved.id)
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({ page: mapExamContentRow(withReviewer) } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-content/upsert_POST] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
