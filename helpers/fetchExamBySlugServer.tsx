import { db } from "./db";

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
    .leftJoin("mockTests", (join) =>
      join
        .onRef("mockTests.examId", "=", "exams.id")
        .on("mockTests.isPublished", "=", true)
    )
    .select([
      "exams.id",
      "exams.examName",
      "exams.fullName",
      "exams.examSlug",
      "exams.description",
      "examCategories.categoryName",
      (eb) => eb.fn.count<number>("mockTests.id").as("testCount"),
    ])
    .where("exams.examSlug", "=", slug)
    .groupBy(["exams.id", "examCategories.id"])
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