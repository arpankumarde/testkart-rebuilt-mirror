import { z } from "zod";
import superjson from "superjson";
import type { AttemptProgressState } from "../../../helpers/testAttemptProgressState";

export const schema = z.object({
  attemptId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  attemptId: number;
  startedAt: Date;
  elapsedSeconds: number;
  state: AttemptProgressState;
  /** Live test papers only: seconds left on the running clock. */
  liveSecondsLeft: number | null;
};

export const postStudentTestItemResumeAttempt = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/student/test-item/resume-attempt`, {
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