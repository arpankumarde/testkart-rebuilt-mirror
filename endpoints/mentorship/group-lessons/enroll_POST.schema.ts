import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  groupLessonId: z.number().int().positive(),
  paymentOrderId: z.number().int().positive().optional(),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { enrollmentId: number };

export const postMentorshipGroupLessonEnroll = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/group-lessons/enroll`, {
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
