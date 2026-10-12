import { db } from "./db";
import { examCustomPages } from "./examCustomPages";
import { isExamContentPageType, type ExamSectionPageType, type FaqItem } from "./examContentTypes";
import type { OutputType, PublicExamContentPage } from "../endpoints/exam-content/get_GET.schema";

// Shared by exam-content/get and the /exams/:examSlug/* SSR prefetches.
// Null when the exam does not exist.
export const fetchExamContentServer = async (
  examSlug: string,
  pageType: ExamSectionPageType
): Promise<OutputType | null> => {
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
    .where("exams.examSlug", "=", examSlug)
    .executeTakeFirst();

  if (!exam) return null;

  const [publishedRows, customPages] = await Promise.all([
    db
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
      .execute(),
    examCustomPages.list(exam.id),
  ]);

  // Only the 4 routable silo types belong in this list — "overview" is
  // never a link target, it's folded straight into the hub page itself.
  const publishedPageTypes = publishedRows
    .map((row) => row.pageType)
    .filter(isExamContentPageType);
  const publishedTypeSet = new Set(publishedRows.map((row) => row.pageType));
  const publishedCustomPages = customPages
    .filter((customPage) => publishedTypeSet.has(customPage.pageType))
    .map(({ slug, label }) => ({ slug, label }));
  const matching = publishedRows.find((row) => row.pageType === pageType);

  const page: PublicExamContentPage | null =
    matching && matching.publishedAt
      ? {
          pageType,
          title: matching.publishedTitle || `${exam.fullName || exam.examName}`,
          seoTitle: matching.publishedSeoTitle,
          seoDescription: matching.publishedSeoDescription,
          description: matching.publishedDescription,
          content: matching.publishedContent,
          faqItems: (matching.publishedFaqItems as unknown as FaqItem[] | null) ?? null,
          publishedAt: matching.publishedAt,
        }
      : null;

  return {
    exam: {
      id: exam.id,
      examName: exam.examName,
      fullName: exam.fullName,
      examSlug: exam.examSlug,
      categoryName: exam.categoryName,
    },
    page,
    publishedPageTypes,
    publishedCustomPages,
  };
};
