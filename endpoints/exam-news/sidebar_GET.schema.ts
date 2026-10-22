import { z } from "zod";
import superjson from "superjson";
import type { ExamNewsType } from "../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type PublicExamNewsExam = { name: string; slug: string; count: number };

export type OutputType = {
  /** The popular exams that exist, in the fixed order, with how many published stories each has. */
  popularExams: PublicExamNewsExam[];
  /** Every exam with at least one published story, most stories first. */
  examsWithNews: PublicExamNewsExam[];
  typeCounts: Partial<Record<ExamNewsType, number>>;
  /** Published stories an admin has changed since they first went live, latest edit first. */
  recentlyUpdated: {
    title: string;
    slug: string;
    newsType: ExamNewsType;
    examName: string | null;
    lastEditedAt: Date;
  }[];
};

export const getExamNewsSidebar = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/exam-news/sidebar`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};