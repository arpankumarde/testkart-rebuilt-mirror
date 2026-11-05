import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  bookingId: z.number().int().positive(),
  newStartTime: z.coerce.date(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { newBookingId: number; scheduledAt: Date };

export const postMentorshipBookingReschedule = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/bookings/reschedule`, {
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
