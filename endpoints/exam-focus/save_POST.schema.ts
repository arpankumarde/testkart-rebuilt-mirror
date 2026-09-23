import { z } from "zod";
import superjson from "superjson";
import { MAX_EXAM_FOCUS, type ExamFocusItem } from "../../helpers/examFocusShared";

export const schema = z.object({
  examIds: z
    .array(z.number().int().positive())
    .min(1, "Pick at least one exam.")
    .max(MAX_EXAM_FOCUS, `Pick up to ${MAX_EXAM_FOCUS} exams.`),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  examFocus: ExamFocusItem[];
};

export const postExamFocusSave = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/exam-focus/save`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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