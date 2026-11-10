import { z } from "zod";
import superjson from "superjson";

/** Books a paid package class that is waiting for a time. */
export const schema = z.object({
  creditId: z.string().uuid(),
  startTime: z.coerce.date(),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { bookingId: string; scheduledAt: Date };

export const postMentorshipCreditSchedule = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/credits/schedule`, {
    method: "POST",
    body: superjson.stringify(schema.parse(body)),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
