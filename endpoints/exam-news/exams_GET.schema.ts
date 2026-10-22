import { z } from "zod";
import superjson from "superjson";

/** A light exam lookup for the picker: there are well over a thousand exams, so it searches server-side, a page at a time. */
export const schema = z.object({
  search: z.string().trim().max(120).optional(),
  id: z.number().int().positive().optional(),
  offset: z.number().int().min(0).max(10000).default(0),
});

export type InputType = z.input<typeof schema>;

export type ExamNewsExamOption = {
  id: number;
  examName: string;
  fullName: string;
  examSlug: string;
  categoryName: string | null;
};

export type OutputType = { exams: ExamNewsExamOption[]; hasMore: boolean };

export const getExamNewsExams = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.search) params.append("search", input.search);
  if (input.id) params.append("id", String(input.id));
  if (input.offset) params.append("offset", String(input.offset));
  const result = await fetch(`/_api/exam-news/exams?${params.toString()}`, {
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
