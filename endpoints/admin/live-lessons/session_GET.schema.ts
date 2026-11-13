import { z } from "zod";
import superjson from "superjson";
import type { LiveCalendarEvent } from "./calendar_GET.schema";
import type { LivePaymentStatus } from "./bookings_GET.schema";

export const schema = z.object({
  kind: z.literal("booking"),
  id: z.string().uuid(),
});

export type InputType = z.infer<typeof schema>;

export const SESSION_ATTENDEES_LIMIT = 200;

export type LiveSessionDetail = LiveCalendarEvent & {
  /** Why the teacher did not hold it, when status is missed. */
  missedReason: string | null;
  completedAt: Date | null;
  completedBy: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
};

/** Did this learner attend: upcoming | attended | missed | cancelled (their place was cancelled). */
export type LiveAttendanceStatus = "upcoming" | "attended" | "missed" | "cancelled";

/** The learner's place: the 1:1 booking. */
export type LiveAttendeeRow = {
  type: "booking";
  /** The booking id. */
  id: string;
  sessionId: string;
  studentId: number | null;
  studentName: string | null;
  studentEmail: string | null;
  bookedAt: Date | null;
  price: number;
  /** What was actually received: the price when paid (or paid and later refunded) or paid by credit, otherwise 0. */
  amountPaid: number;
  paymentStatus: LivePaymentStatus;
  orderId: number | null;
  orderStatus: string | null;
  paymentMethod: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  creditKind: string | null;
  isTrial: boolean;
  attendance: LiveAttendanceStatus;
  /** Where the attendance comes from: an admin or teacher mark, the teacher's no-show, a classroom join, or no join. */
  attendanceBasis: "marked" | "teacher" | "classroom" | "no_join" | null;
  attendanceMarkedBy: string | null;
  attendanceMarkedAt: Date | null;
  /** The place is not cancelled and the session has started, so attendance can be set. */
  canMark: boolean;
};

/** One change from live_session_events, oldest first. */
export type LiveSessionEvent = {
  id: string;
  fromStatus: string | null;
  /** A session status, or attendance_attended / attendance_missed for a learner's attendance. */
  toStatus: string;
  actorType: "admin" | "teacher" | "learner" | "system";
  actorLabel: string | null;
  reason: string | null;
  createdAt: Date;
};

export type OutputType = {
  session: LiveSessionDetail;
  attendees: LiveAttendeeRow[];
  history: LiveSessionEvent[];
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