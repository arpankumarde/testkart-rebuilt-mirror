import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  examSlug: z.string().min(1),
});

export type InputType = z.infer<typeof schema>;

export type ExamDetail = {
  id: number;
  examName: string;
  fullName: string | null;
  examSlug: string;
  description: string | null;
  categoryName: string;
};

// exam is null for an unknown slug; the exam pages render that as "Exam Not Found".
export type OutputType = {
  exam: ExamDetail | null;
};

export const getExamBySlug = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(input);
  const searchParams = new URLSearchParams({ examSlug: validatedInput.examSlug });
  const result = await fetch(`/_api/exams/by-slug?${searchParams.toString()}`, {
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