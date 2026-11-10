import { z } from "zod";
import superjson from "superjson";

export const BOOKINGS_MAX_PAGE_SIZE = 100;

export const schema = z.object({
  q: z.string().trim().max(120).optional(),
  /** The list only ever holds completed and cancelled bookings; this narrows it to one of the two. */
  status: z.enum(["completed", "cancelled"]).optional(),
  type: z.enum(["booking", "group"]).optional(),
  payment: z.enum(["paid", "pending", "refunded", "failed", "credit", "free"]).optional(),
  teacherId: z.coerce.number().int().positive().optional(),
  /** A 1:1 booking id or a group lesson id: limits the list to that session's bookings. */
  sessionId: z.string().uuid().optional(),
  /** Session start range, as instants. */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["booked", "session"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(BOOKINGS_MAX_PAGE_SIZE).optional(),
});

export type InputType = z.input<typeof schema>;

export type LivePaymentStatus = "paid" | "pending" | "refunded" | "failed" | "credit" | "free";

export type LiveBookingRow = {
  /** "booking" is a 1:1 mentorship booking; "group" is a group lesson enrollment. */
  type: "booking" | "group";
  id: string;
  /** The 1:1 booking itself, or the group lesson the enrollment belongs to. */
  sessionId: string;
  studentId: number | null;
  studentName: string | null;
  studentEmail: string | null;
  teacherId: number;
  teacherName: string | null;
  teacherAvatarUrl: string | null;
  sessionTitle: string;
  bookedAt: Date | null;
  sessionStart: Date;
  sessionEnd: Date;
  durationMinutes: number;
  /** scheduled | completed | cancelled | no_show | removed */
  status: string;
  sessionStatus: string;
  /** The session price stored on the booking or enrollment. */
  price: number;
  /** What was actually received: the price when the payment completed (or was later refunded) or came from a live class credit, otherwise 0. */
  amountPaid: number;
  /** From the payment order, independent of the booking status. */
  paymentStatus: LivePaymentStatus;
  orderId: number | null;
  orderStatus: string | null;
  paymentMethod: string | null;
  paymentTransactionId: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  refundReason: string | null;
  /** "trial" or "package" when the class was paid from a live class credit. */
  creditKind: string | null;
  isTrial: boolean;
  fromPackage: boolean;
  cancellationReason: string | null;
  cancelledBy: string | null;
  cancelledAt: Date | null;
  issueReportedAt: Date | null;
  issueNote: string | null;
  issueResolution: string | null;
  issueResolvedAt: Date | null;
  maxCapacity: number | null;
  enrolledCount: number | null;
};

export type BookingsSummary = { total: number; completed: number; cancelled: number };

export type OutputType = {
  rows: LiveBookingRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Counts over every completed and cancelled booking, not just the filtered ones. */
  summary: BookingsSummary;
};

export const getAdminLiveBookings = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  const result = await fetch(`/_api/admin/live-lessons/bookings?${params.toString()}`, {
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