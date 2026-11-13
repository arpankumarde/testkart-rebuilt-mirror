import { z } from "zod";
import superjson from "superjson";

export const ENROLLMENT_FILTERS = ["all", "enrolled", "refund_open", "refunded"] as const;
export type EnrollmentFilter = (typeof ENROLLMENT_FILTERS)[number];

export const ENROLLMENTS_LIMIT = 300;

/* Only a SUCCESS refund needs nothing more; PENDING is in progress, CANCELLED and ONHOLD need an admin. */
export const SETTLED_REFUND_STATUSES = ["SUCCESS"] as const;

export const schema = z.object({
  filter: z.enum(ENROLLMENT_FILTERS).default("all"),
  q: z.string().trim().max(100).optional(),
});
export type InputType = z.input<typeof schema>;

export type AdminLiveCourseEnrollmentRow = {
  id: string;
  status: "enrolled" | "refunded" | "removed";
  amountPaid: number;
  enrolledAt: Date;
  orderId: number | null;
  refundAmount: number | null;
  refundStatus: string | null;
  refundRequestedAt: Date | null;
  refundedAt: Date | null;
  student: { id: number; name: string; email: string | null };
  course: { id: string; title: string; status: string };
  teacherName: string;
};

export type OutputType = { enrollments: AdminLiveCourseEnrollmentRow[]; truncated: boolean };

export const getAdminLiveCourseEnrollments = async (input: InputType = {}, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.filter) params.set("filter", input.filter);
  if (input.q) params.set("q", input.q);
  const result = await fetch(`/_api/admin/live-courses/enrollments?${params.toString()}`, {
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
