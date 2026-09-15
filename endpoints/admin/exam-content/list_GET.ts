import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType, ExamContentPageItem } from "./list_GET.schema";
import superjson from "superjson";
import { ADMIN_EXAM_SECTION_TYPES } from "../../../helpers/examContentTypes";
import { mapExamContentRow, EXAM_CONTENT_SELECT_COLUMNS } from "../../../helpers/examContentMapper";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ["super_admin", "admin", "manager"]);

    const url = new URL(request.url);
    const validatedInput = schema.parse({
      examId: Number(url.searchParams.get("examId")),
    });

    const exam = await db
      .selectFrom("exams")
      .innerJoin("examCategories", "exams.categoryId", "examCategories.id")
      .select([
        "exams.id",
        "exams.examName",
        "exams.fullName",
        "exams.examSlug",
        "examCategories.categoryName",
      ])
      .where("exams.id", "=", validatedInput.examId)
      .executeTakeFirst();

    if (!exam) {
      return new Response(superjson.stringify({ error: "Exam not found." }), { status: 404 });
    }

    const existingRows = await db
      .selectFrom("examContentPages")
      .leftJoin("admins", "examContentPages.reviewedByAdminId", "admins.id")
      .leftJoin(
        "admins as readyForReviewAdmins",
        "examContentPages.readyForReviewByAdminId",
        "readyForReviewAdmins.id"
      )
      .select(EXAM_CONTENT_SELECT_COLUMNS)
      .where("examContentPages.examId", "=", validatedInput.examId)
      .execute();

    const byType = new Map(existingRows.map((row) => [row.pageType, row]));

    // Always return one entry per known page type — even if nothing has been
    // authored yet — so the admin UI can render a stable set of tabs without
    // special-casing "not created yet".
    const pages: ExamContentPageItem[] = ADMIN_EXAM_SECTION_TYPES.map((pageType) => {
      const row = byType.get(pageType);
      if (!row) {
        return {
          id: null,
          examId: validatedInput.examId,
          pageType,
          status: "draft",
          title: "",
          seoTitle: null,
          seoDescription: null,
          description: null,
          content: null,
          faqItems: null,
          source: "manual",
          aiGeneratedAt: null,
          publishedTitle: null,
          publishedSeoTitle: null,
          publishedSeoDescription: null,
          publishedDescription: null,
          publishedContent: null,
          publishedFaqItems: null,
          publishedAt: null,
          reviewedByAdminId: null,
          reviewedByAdminName: null,
          reviewedAt: null,
          readyForReviewAt: null,
          readyForReviewByAdminId: null,
          readyForReviewByAdminName: null,
          updatedAt: null,
        };
      }
      return mapExamContentRow(row);
    });

    return new Response(
      superjson.stringify({
        exam: {
          id: exam.id,
          examName: exam.examName,
          fullName: exam.fullName,
          examSlug: exam.examSlug,
          categoryName: exam.categoryName,
        },
        pages,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-content/list_GET] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
