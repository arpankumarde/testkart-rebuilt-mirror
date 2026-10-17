import { z } from "zod";
import superjson from "superjson";

/** A light exam lookup for the picker: there are well over a thousand exams, so it searches server-side. */
export const schema = z.object({
  search: z.string().trim().max(120).optional(),
  id: z.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type ExamNewsExamOption = {
  id: number;
  examName: string;
  fullName: string;
  examSlug: string;
  categoryName: string | null;
};

export type OutputType = { exams: ExamNewsExamOption[] };

export const getAdminExamNewsExams = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.search) params.append("search", input.search);
  if (input.id) params.append("id", String(input.id));
  const result = await fetch(`/_api/admin/exam-news/exams?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};