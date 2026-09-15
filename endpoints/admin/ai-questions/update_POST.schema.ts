import { z } from "zod";
import superjson from "superjson";
import { type Selectable } from "kysely";
import { type TestQuestions } from "../../../helpers/schema";

export const schema = z.object({
  id: z.number(),
  questionText: z.string().min(1, "Question text cannot be empty."),
  optionA: z.string().min(1, "Option A cannot be empty."),
  optionB: z.string().min(1, "Option B cannot be empty."),
  optionC: z.string().min(1, "Option C cannot be empty."),
  optionD: z.string().min(1, "Option D cannot be empty."),
  optionE: z.string().optional().nullable(),
  correctOption: z.enum(["A", "B", "C", "D", "E"]),
  explanation: z.string().nullable().optional(),
  markedForReview: z.boolean(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  question: Selectable<TestQuestions>;
};

export const postAdminUpdateAIQuestion = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/ai-questions/update`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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