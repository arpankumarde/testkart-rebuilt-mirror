import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  attemptId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  ok: true;
};

export const postStudentTestItemDiscardAttempt = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/student/test-item/discard-attempt`, {
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