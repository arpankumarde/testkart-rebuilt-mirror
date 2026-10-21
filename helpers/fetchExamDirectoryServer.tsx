import { db } from "./db";
import { examNewsServer } from "./examNewsServer";
import type { OutputType } from "../endpoints/exams/directory_GET.schema";

// How long a published Exam News story keeps its exam marked "Hot" on /exams.
export const HOT_NEWS_DAYS = 30;

// Shared by exams/directory and the /exams SSR prefetch. Same ordering as
// exams/list.
export const fetchExamDirectoryServer = async (): Promise<OutputType> => {
  await examNewsServer.promoteDue();
  const hotSince = new Date(Date.now() - HOT_NEWS_DAYS * 24 * 60 * 60 * 1000);
  const [categories, exams, hotRows] = await Promise.all([
    db
      .selectFrom("examCategories")
      .select(["id", "categoryName"])
      .orderBy("orderIndex", "asc")
      .orderBy("categoryName", "asc")
      .execute(),
    db
      .selectFrom("exams")
      .select(["id", "categoryId", "examName", "fullName", "examSlug"])
      .orderBy("orderIndex", "asc")
      .orderBy("examName", "asc")
      .execute(),
    db
      .selectFrom("examNewsPosts")
      .select("examId")
      .distinct()
      .where("status", "=", "published")
      .where("examId", "is not", null)
      .where("publishedAt", ">=", hotSince)
      .execute(),
  ]);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      categoryName: category.categoryName,
      exams: exams
        .filter((exam) => exam.categoryId === category.id)
        .map(({ id, examName, fullName, examSlug }) => ({ id, examName, fullName, examSlug })),
    })),
    hotExamIds: hotRows.flatMap((row) => (row.examId == null ? [] : [row.examId])),
  };
};
