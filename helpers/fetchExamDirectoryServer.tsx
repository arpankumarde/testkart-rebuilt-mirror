import { db } from "./db";
import type { OutputType } from "../endpoints/exams/directory_GET.schema";

// Shared by exams/directory and the /exams SSR prefetch. Same ordering as
// exams/list.
export const fetchExamDirectoryServer = async (): Promise<OutputType> => {
  const [categories, exams] = await Promise.all([
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
  ]);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      categoryName: category.categoryName,
      exams: exams
        .filter((exam) => exam.categoryId === category.id)
        .map(({ id, examName, fullName, examSlug }) => ({ id, examName, fullName, examSlug })),
    })),
  };
};
