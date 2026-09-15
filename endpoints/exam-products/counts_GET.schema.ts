import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  examSlug: z.string().min(1),
});

export type InputType = z.infer<typeof schema>;

export type ExamProductCounts = {
  mockTests: number;
  digitalProducts: number;
  courses: number;
  bundles: number;
};

export type OutputType = {
  examId: number | null;
  counts: ExamProductCounts;
};

export const getExamProductCounts = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(input);
  const searchParams = new URLSearchParams({ examSlug: validatedInput.examSlug });
  const result = await fetch(`/_api/exam-products/counts?${searchParams.toString()}`, {
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
