import { z } from "zod";
import superjson from "superjson";
import { MENTORSHIP_MIN_CLASS_PRICE } from "../../../helpers/liveLessonConfig";

const price = (minutes: 30 | 60) =>
  z
    .number()
    .int("Use whole rupees")
    .min(MENTORSHIP_MIN_CLASS_PRICE[minutes], `A ${minutes}-minute class must cost at least ₹${MENTORSHIP_MIN_CLASS_PRICE[minutes]}`)
    .max(100000);

export const schema = z.object({
  enabled: z.boolean(),
  /** Both class prices and the trial discount switch. Omit to only switch bookings on or off. */
  prices: z
    .object({
      class30: price(30),
      class60: price(60),
      trialDiscount: z.boolean(),
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
