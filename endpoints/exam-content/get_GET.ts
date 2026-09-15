import { db } from "../../helpers/db";
import { schema, OutputType, PublicExamContentPage } from "./get_GET.schema";
import superjson from "superjson";
import { isExamContentPageType, type FaqItem } from "../../helpers/examContentTypes";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const validatedInput = schema.parse({
      examSlug: url.searchParams.get("examSlug"),
      pageType: url.searchParams.get("pageType"),
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
      .where("exams.examSlug", "=", validatedInput.examSlug)
      .executeTakeFirst();

    if (!exam) {
      return new Response(superjson.stringify({ error: "Exam not found." }), { status: 404 });
    }

    const publishedRows = await db
      .selectFrom("examContentPages")
      .select([
        "pageType",
        "publishedTitle",
        "publishedSeoTitle",
        "publishedSeoDescription",
        "publishedDescription",
        "publishedContent",
        "publishedFaqItems",
        "publishedAt",
      ])
      .where("examId", "=", exam.id)
      .where("status", "=", "published")
      .execute();

    // Only the 4 routable silo types belong in this list — "overview" is
    // never a link target, it's folded straight into the hub page itself.
    const publishedPageTypes = publishedRows
      .map((row) => row.pageType)
      .filter(isExamContentPageType);
    const matching = publishedRows.find((row) => row.pageType === validatedInput.pageType);

    const page: PublicExamContentPage | null =
      matching && matching.publishedAt
        ? {
            pageType: validatedInput.pageType,
            title: matching.publishedTitle || `${exam.fullName || exam.examName}`,
            seoTitle: matching.publishedSeoTitle,
            seoDescription: matching.publishedSeoDescription,
            description: matching.publishedDescription,
            content: matching.publishedContent,
            faqItems: (matching.publishedFaqItems as unknown as FaqItem[] | null) ?? null,
            publishedAt: matching.publishedAt,
          }
        : null;

    return new Response(
      superjson.stringify({
        exam: {
          id: exam.id,
          examName: exam.examName,
          fullName: exam.fullName,
          examSlug: exam.examSlug,
          categoryName: exam.categoryName,
        },
        page,
        publishedPageTypes,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[exam-content/get_GET] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
