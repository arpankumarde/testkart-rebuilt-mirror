import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  /** "upcoming" (default) = scheduled and not yet ended; "past" = completed/no_show/ended; "cancelled"; "all". */
  filter: z.enum(["upcoming", "past", "cancelled", "all"]).optional(),
  limit: z.number().int().positive().max(500).optional(),
  /** Optional window on scheduledAt, [from, to). With a window the rows come oldest first. */
  from: z.date().optional(),
  to: z.date().optional(),
});

export type InputType = z.infer<typeof schema>;

export type MentorshipBookingRow = {
  id: string;
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
  rescheduledFromBookingId: string | null;
  /** "single": a paid 1:1 session bought before trials and packages existed. */
  kind: "trial" | "package" | "single";
  packageId: string | null;
  /** The student can still cancel or move it without being charged. */
  freeChange: boolean;
  /** The student can report that the teacher did not take this class. */
  canReport: boolean;
  issue: { reportedAt: Date; resolution: string | null } | null;
  /** "teacher" or "learner" when status is no_show. */
  noShowParty: string | null;
};

export type OutputType = { bookings: MentorshipBookingRow[] };

export const getMentorshipBookingsList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.filter) params.set("filter", input.filter);
  if (input.limit) params.set("limit", String(input.limit));
  if (input.from) params.set("from", input.from.toISOString());
  if (input.to) params.set("to", input.to.toISOString());
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
