import { z } from "zod";
import superjson from "superjson";
import type { LiveCalendarEvent } from "./calendar_GET.schema";

export const BOOKINGS_MAX_PAGE_SIZE = 100;

/* The Bookings tab: every 1:1 session, newest first, with a search and a session date range. */
export const schema = z.object({
  /** Matches the session title, teacher, session id, and any learner's name, email, booking id or order number. */
  q: z.string().trim().max(120).optional(),
  /** Session start range, as instants. */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(BOOKINGS_MAX_PAGE_SIZE).optional(),
});

export type InputType = z.input<typeof schema>;

export type LivePaymentStatus = "paid" | "pending" | "refunded" | "failed" | "credit" | "free";

export type LiveSessionListRow = LiveCalendarEvent & {
  /** Total actually received across the session's learners. */
  amountReceived: number;
  /** Learners whose payment completed or came from a class credit. */
  paidCount: number;
  /** The learner's payment status. */
  paymentStatus: LivePaymentStatus | null;
};

export type OutputType = {
  rows: LiveSessionListRow[];
  total: number;
  page: number;
  pageSize: number;
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