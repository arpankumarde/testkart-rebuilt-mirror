import { z } from "zod";
import superjson from "superjson";

/** A student reports that the teacher did not take a paid class. An admin decides. */
export const schema = z.object({
  bookingId: z.string().uuid(),
  note: z.string().trim().min(5, "Tell us briefly what happened").max(1000),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export const postMentorshipBookingReport = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/bookings/report`, {
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
