import { z } from "zod";
import superjson from "superjson";
import { MENTORSHIP_MIN_RATE_PER_UNIT } from "../../../helpers/liveLessonConfig";

const price = z.number().int("Use whole rupees").min(0).max(100000);

export const schema = z.object({
  enabled: z.boolean(),
  /** Older callers: the 25-minute class price only. */
  ratePerUnit: z
    .number()
    .min(MENTORSHIP_MIN_RATE_PER_UNIT, `Must be at least ₹${MENTORSHIP_MIN_RATE_PER_UNIT} per 25 minutes`)
    .optional(),
  /** All four prices. Class prices have floors (see helpers/livePricing); trials may be free. */
  prices: z
    .object({
      trial25: price,
      trial50: price,
      class25: price,
      class50: price,
    })
    .optional(),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export const postTeacherMentorshipRate = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/mentorship/rate`, {
    method: "POST",
    body: superjson.stringify(input),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
