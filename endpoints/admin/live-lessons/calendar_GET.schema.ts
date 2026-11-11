import { z } from "zod";
import superjson from "superjson";

export const CALENDAR_MAX_RANGE_DAYS = 100;
export const CALENDAR_EVENT_LIMIT = 1500;

export const schema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    /** Comma-separated session kinds; omitted means both. */
    kinds: z.string().optional(),
    /** The teacher's session status. */
    status: z.enum(["scheduled", "completed", "missed", "cancelled"]).optional(),
    teacherId: z.coerce.number().int().positive().optional(),
    q: z.string().trim().max(120).optional(),
  })
  .refine((v) => v.to > v.from, { message: "The end of the range must be after its start." })
  .refine((v) => v.to.getTime() - v.from.getTime() <= CALENDAR_MAX_RANGE_DAYS * 86400000, {
    message: `A calendar range can cover at most ${CALENDAR_MAX_RANGE_DAYS} days.`,
  });

export type InputType = z.input<typeof schema>;

/** Did the teacher hold the session. */
export type LiveSessionStatus = "scheduled" | "completed" | "missed" | "cancelled";

export type LiveCalendarEvent = {
  kind: "booking" | "group";
  id: string;
  title: string;
  teacherId: number;
  teacherName: string | null;
  teacherAvatarUrl: string | null;
  studentName: string | null;
  start: Date;
  end: Date;
  durationMinutes: number;
  status: LiveSessionStatus;
  /** Still scheduled although its end time has passed: nobody has marked it yet. */
  unmarked: boolean;
  /** 1 for a 1:1 session; enrolled learners for a group lesson. */
  studentCount: number;
  maxCapacity: number | null;
  price: number;
  isTrial: boolean;
  cancellationReason: string | null;
};

export type OutputType = {
  events: LiveCalendarEvent[];
  /** True when the range held more sessions than CALENDAR_EVENT_LIMIT; only the first ones are returned. */
  truncated: boolean;
};

export const getAdminLiveCalendar = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  params.set("from", new Date(input.from as Date | string).toISOString());
  params.set("to", new Date(input.to as Date | string).toISOString());
  if (input.kinds) params.set("kinds", input.kinds);
  if (input.status) params.set("status", input.status);
  if (input.teacherId) params.set("teacherId", String(input.teacherId));
  if (input.q) params.set("q", input.q);
  const result = await fetch(`/_api/admin/live-lessons/calendar?${params.toString()}`, {
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