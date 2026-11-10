import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  teacherId: z.number().int().positive(),
  /** 25 or 50 minutes - see MENTORSHIP_SESSION_DURATIONS. */
  durationMinutes: z.number().int().positive(),
  startTime: z.coerce.date(),
  /** Required unless the teacher's rate computes to 0 for this duration; omit for free sessions. */
  paymentOrderId: z.number().int().positive().optional(),
  studentNotes: z.string().trim().max(2000).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { bookingId: string; status: string; scheduledAt: Date; isTrial: boolean };

export const postMentorshipBookingCreate = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/bookings/create`, {
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
