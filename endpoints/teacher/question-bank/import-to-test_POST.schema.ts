import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  questionBankIds: z.array(z.number().int().positive()).min(1),
  subjectId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { 
  success: boolean;
  importedCount: number;
};

export const postTeacherQuestionBankImportToTest = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/question-bank/import-to-test`, {
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