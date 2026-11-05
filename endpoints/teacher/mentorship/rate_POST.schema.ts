import { z } from "zod";
import superjson from "superjson";
import { MENTORSHIP_MIN_RATE_PER_UNIT } from "../../../helpers/liveLessonConfig";

export const schema = z.object({
  enabled: z.boolean(),
  /** Price per MENTORSHIP_RATE_UNIT_MINUTES (25) minutes. Required when enabling. */
  ratePerUnit: z
    .number()
    .min(MENTORSHIP_MIN_RATE_PER_UNIT, `Must be at least ₹${MENTORSHIP_MIN_RATE_PER_UNIT} per 25 minutes`)
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
