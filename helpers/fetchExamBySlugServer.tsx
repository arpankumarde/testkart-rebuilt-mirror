import { db } from "./db";
import { sql } from "kysely";

export type ExamDetailServerData = {
  id: number;
  examName: string;
  fullName: string | null;
  examSlug: string;
  description: string | null;
  categoryName: string;
  testCount: number;
};

export const fetchExamBySlugServer = async (
  slug: string
): Promise<ExamDetailServerData | null> => {
  const exam = await db
    .selectFrom("exams")
    .leftJoin("examCategories", "examCategories.id", "exams.categoryId")
    .select([
      "exams.id",
      "exams.examName",
      "exams.fullName",
      "exams.examSlug",
      "exams.description",
      "examCategories.categoryName",
      // Published series listed under this exam, as their primary exam or any other.
      sql<number>`(
        SELECT count(*) FROM mock_tests mt
        WHERE mt.is_published = true AND (mt.exam_id = exams.id OR EXISTS (
          SELECT 1 FROM mock_test_exams mte WHERE mte.mock_test_id = mt.id AND mte.exam_id = exams.id
        ))
      )`.as("testCount"),
    ])
    .where("exams.examSlug", "=", slug)
    .executeTakeFirst();

  if (!exam) {
    return null;
  }

  return {
    id: exam.id,
    examName: exam.examName,
    fullName: exam.fullName,
    examSlug: exam.examSlug,
    description: exam.description,
    categoryName: exam.categoryName ?? "Uncategorized",
    testCount: Number(exam.testCount || 0),
  };
};