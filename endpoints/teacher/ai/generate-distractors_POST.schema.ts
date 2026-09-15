import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  correctAnswerText: z.string().min(1, "Correct answer text is required"),
  existingOptionTexts: z.array(z.string()).optional().default([]),
  count: z.number().int().min(1).max(4),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  distractors: string[];
};

export class GenerateDistractorsError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
    this.name = "GenerateDistractorsError";
  }
}

export const postTeacherGenerateDistractors = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/ai/generate-distractors`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; code?: string }>(
      await result.text()
    );
    throw new GenerateDistractorsError(errorObject.error, errorObject.code);
  }

  return superjson.parse<OutputType>(await result.text());
};
