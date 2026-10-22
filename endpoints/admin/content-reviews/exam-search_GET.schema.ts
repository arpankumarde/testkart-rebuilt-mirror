import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ search: z.string().trim().min(2).max(120) });

export type InputType = z.infer<typeof schema>;

export type ExamSearchResult = { id: number; examName: string; fullName: string; categoryName: string | null };

export type OutputType = { exams: ExamSearchResult[] };

export const getAdminExamSearch = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const query = new URLSearchParams({ search: input.search });
  const result = await fetch(`/_api/admin/content-reviews/exam-search?${query.toString()}`, {
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