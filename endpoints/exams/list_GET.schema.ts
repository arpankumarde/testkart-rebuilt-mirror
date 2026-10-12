import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

// Served for the shipped mobile app (live tests exam filter), which reads
// category id/exams and exam id, examName, fullName, examSlug, so never drop
// those. The web uses exams/directory and exams/by-slug instead.
export type PublicExam = {
  id: number;
  examName: string;
  fullName: string | null;
  examSlug: string;
};

export type ExamCategoryWithExams = {
  id: number;
  categoryName: string;
  exams: PublicExam[];
};

export type OutputType = {
  categories: ExamCategoryWithExams[];
};

export const getPublicExamCategories = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/exams/list`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};