import { z } from "zod";
import superjson from "superjson";
import { attemptProgressStateSchema } from "../../../helpers/testAttemptProgressState";

export const schema = z.object({
  attemptId: z.number().int().positive(),
  elapsedSeconds: z.number().int().min(0).max(30 * 24 * 3600),
  state: attemptProgressStateSchema,
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  ok: true;
  savedAt: Date;
};

export const SAVE_PROGRESS_URL = `/_api/student/test-item/save-progress`;

export const postStudentTestItemSaveProgress = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(SAVE_PROGRESS_URL, {
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