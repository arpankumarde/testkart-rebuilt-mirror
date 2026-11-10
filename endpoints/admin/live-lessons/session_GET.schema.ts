import { z } from "zod";
import superjson from "superjson";
import type { LiveCalendarEvent } from "./calendar_GET.schema";
import type { LiveBookingRow } from "./bookings_GET.schema";

export const schema = z.object({
  kind: z.enum(["booking", "group"]),
  id: z.string().uuid(),
});

export type InputType = z.infer<typeof schema>;

export const SESSION_BOOKINGS_LIMIT = 100;

export type LiveSessionDetail = LiveCalendarEvent & {
  description: string | null;
  subject: string | null;
  level: string | null;
  language: string | null;
  minEnrollment: number | null;
  hasMeetingLink: boolean;
  createdAt: Date | null;
};

export type OutputType = {
  session: LiveSessionDetail;
  /** The learner's booking for a 1:1 session; the enrollments (newest first) for a group lesson. */
  bookings: LiveBookingRow[];
  bookingsTotal: number;
};

export const getAdminLiveSession = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ kind: input.kind, id: input.id });
  const result = await fetch(`/_api/admin/live-lessons/session?${params.toString()}`, {
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