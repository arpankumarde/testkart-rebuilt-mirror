import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  /** "upcoming" (default) = scheduled and not yet ended; "past" = completed/no_show/ended; "cancelled"; "all". */
  filter: z.enum(["upcoming", "past", "cancelled", "all"]).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export type InputType = z.infer<typeof schema>;

export type MentorshipBookingRow = {
  id: number;
  status: string;
  scheduledAt: Date;
  durationMinutes: number;
  amountPaid: number;
  sessionTitle: string;
  isTrial: boolean;
  teacherId: number;
  teacherName: string;
  teacherAvatarUrl: string | null;
  studentId: number;
  studentName: string;
  studentAvatarUrl: string | null;
  cancellationReason: string | null;
  rescheduledFromBookingId: number | null;
};

export type OutputType = { bookings: MentorshipBookingRow[] };

export const getMentorshipBookingsList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.filter) params.set("filter", input.filter);
  if (input.limit) params.set("limit", String(input.limit));
  const result = await fetch(`/_api/mentorship/bookings/list?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
