import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().trim().min(3, "Give a short reason.").max(500),
});

export type InputType = z.infer<typeof schema>;
/**
 * credit, for paid classes: "spent" when a late student cancel was charged, "unscheduled" when a
 * package class waits for a new time, "released" when its price went to the live class balance.
 */
export type OutputType = { success: true; credit: "spent" | "unscheduled" | "released" | null };

export const postMentorshipBookingCancel = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/bookings/cancel`, {
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
