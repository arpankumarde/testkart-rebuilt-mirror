import { z } from "zod";
import superjson from "superjson";
import type { AttemptProgressState } from "../../../helpers/testAttemptProgressState";

export const schema = z.object({
  testItemId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type SavedAttempt = {
  attemptId: number;
  startedAt: Date | null;
  savedAt: Date;
  answeredCount: number;
  totalQuestions: number;
  elapsedSeconds: number;
  state: AttemptProgressState;
  /** Live test papers only: seconds left on the running clock. */
  liveSecondsLeft: number | null;
};

export type OutputType = {
  attempt: SavedAttempt | null;
};

export const getStudentTestItemSavedAttempt = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({ testItemId: String(validatedParams.testItemId) });
  const result = await fetch(`/_api/student/test-item/saved-attempt?${searchParams.toString()}`, {
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