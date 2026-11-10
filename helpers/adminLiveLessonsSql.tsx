import { sql, type RawBuilder } from "kysely";

/*
 * Server-only SQL sources for the admin Live Lessons module.
 *
 * A "session" is something that happens on the calendar: a 1:1 mentorship booking or a group
 * lesson. A "booking" is one learner's place in a session: a 1:1 mentorship booking or a group
 * lesson enrollment. A 1:1 booking is therefore both, with the same id.
 *
 * mentorship_bookings stores UTC wall-clock times in timestamp-without-time-zone columns, so they
 * are converted with AT TIME ZONE 'UTC' to line up with group_lessons' timestamptz columns.
 */

export const SESSION_KINDS = ["booking", "group"] as const;
export type LiveSessionKind = (typeof SESSION_KINDS)[number];

export const SESSION_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;

/*
 * The calendar shows a session only when its teacher's live teaching application is approved
 * (users.live_teaching_status). Sessions have no approval of their own. Bookings do not use this.
 */
export const approvedTeacherOnly = sql`s.teacher_live_status = 'approved'`;

export const BOOKING_STATUS_FILTERS = ["upcoming", "awaiting", "completed", "cancelled", "no_show"] as const;
export const PAYMENT_STATUSES = ["paid", "pending", "refunded", "failed", "credit", "free"] as const;
export type LivePaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const sessionsSource = sql`
  SELECT
    'booking'::text AS kind,
    mb.id::text AS id,
    '1:1 session with ' || coalesce(st.display_name, 'a learner') AS title,
    mb.teacher_id,
    t.display_name AS teacher_name,
    t.avatar_url AS teacher_avatar_url,
    t.live_teaching_status AS teacher_live_status,
    mb.student_id,
    st.display_name AS student_name,
    (mb.scheduled_at AT TIME ZONE 'UTC') AS start_time,
    mb.duration_minutes,
    coalesce(mb.status::text, 'scheduled') AS status,
    NULL::int AS enrolled_count,
    NULL::int AS max_capacity,
    coalesce(mb.amount_paid, 0) AS price,
    coalesce(mb.is_trial, false) AS is_trial,
    mb.cancellation_reason
  FROM mentorship_bookings mb
  JOIN users t ON t.id = mb.teacher_id
  LEFT JOIN users st ON st.id = mb.student_id
  UNION ALL
  SELECT
    'group'::text,
    gl.id::text,
    gl.title,
    gl.teacher_id,
    t.display_name,
    t.avatar_url,
    t.live_teaching_status,
    NULL::int,
    NULL::text,
    gl.start_time,
    gl.duration_minutes,
    gl.status::text,
    gl.enrolled_count,
    gl.max_capacity,
    coalesce(gl.price_per_learner, 0),
    false,
    gl.cancellation_reason
  FROM group_lessons gl
  JOIN users t ON t.id = gl.teacher_id
`;

export type SessionSqlRow = {
  kind: LiveSessionKind;
  id: string;
  title: string;
  teacherId: number;
  teacherName: string | null;
  teacherAvatarUrl: string | null;
  teacherLiveStatus: string | null;
  studentId: number | null;
  studentName: string | null;
  startTime: Date;
  durationMinutes: number;
  status: string;
  enrolledCount: number | null;
  maxCapacity: number | null;
  price: string | number;
  isTrial: boolean;
  cancellationReason: string | null;
};

export const bookingsSource = sql`
  SELECT
    'booking'::text AS type,
    mb.id::text AS id,
    mb.id::text AS session_id,
    mb.student_id,
    st.display_name AS student_name,
    st.email AS student_email,
    mb.teacher_id,
    t.display_name AS teacher_name,
    t.avatar_url AS teacher_avatar_url,
    '1:1 session with ' || coalesce(st.display_name, 'a learner') AS session_title,
    (mb.created_at AT TIME ZONE 'UTC') AS booked_at,
    (mb.scheduled_at AT TIME ZONE 'UTC') AS session_start,
    mb.duration_minutes,
    coalesce(mb.status::text, 'scheduled') AS status,
    coalesce(mb.status::text, 'scheduled') AS session_status,
    coalesce(mb.amount_paid, 0) AS amount,
    mb.order_id,
    o.status::text AS order_status,
    o.payment_method,
    o.payment_transaction_id,
    o.paid_at,
    o.refunded_at,
    o.refund_reason,
    lc.kind AS credit_kind,
    coalesce(mb.is_trial, false) AS is_trial,
    (mb.package_id IS NOT NULL) AS from_package,
    mb.cancellation_reason,
    mb.cancelled_by,
    (mb.cancelled_at AT TIME ZONE 'UTC') AS cancelled_at,
    mb.issue_reported_at,
    mb.issue_note,
    mb.issue_resolution,
    mb.issue_resolved_at,
    NULL::int AS max_capacity,
    NULL::int AS enrolled_count
  FROM mentorship_bookings mb
  JOIN users t ON t.id = mb.teacher_id
  LEFT JOIN users st ON st.id = mb.student_id
  LEFT JOIN orders o ON o.id = mb.order_id
  LEFT JOIN live_class_credits lc ON lc.id = mb.credit_id
  UNION ALL
  SELECT
    'group'::text,
    e.id::text,
    gl.id::text,
    e.student_id,
    st.display_name,
    st.email,
    gl.teacher_id,
    t.display_name,
    t.avatar_url,
    gl.title,
    e.enrolled_at,
    gl.start_time,
    gl.duration_minutes,
    CASE
      WHEN gl.status::text = 'cancelled' THEN 'cancelled'
      WHEN e.status IN ('cancelled', 'removed') THEN e.status
      WHEN gl.status::text = 'completed' THEN 'completed'
      ELSE 'scheduled'
    END,
    gl.status::text,
    coalesce(e.amount_paid, 0),
    e.order_id,
    o.status::text,
    o.payment_method,
    o.payment_transaction_id,
    o.paid_at,
    o.refunded_at,
    o.refund_reason,
    NULL::text,
    false,
    false,
    CASE WHEN gl.status::text = 'cancelled' THEN gl.cancellation_reason END,
    CASE WHEN e.status = 'removed' OR coalesce(e.removed_by_teacher, false) THEN 'teacher' WHEN e.status = 'cancelled' THEN 'learner' END,
    coalesce(e.cancelled_at, CASE WHEN gl.status::text = 'cancelled' THEN gl.cancelled_at END),
    NULL::timestamptz,
    NULL::text,
    NULL::text,
    NULL::timestamptz,
    gl.max_capacity,
    gl.enrolled_count
  FROM group_lesson_enrollments e
  JOIN group_lessons gl ON gl.id = e.group_lesson_id
  JOIN users t ON t.id = gl.teacher_id
  LEFT JOIN users st ON st.id = e.student_id
  LEFT JOIN orders o ON o.id = e.order_id
`;

/*
 * Payment state of a booking row. The order decides when there is one: completed is paid, and a
 * failed, cancelled or never-finished order is not. Without an order, a live class credit counts
 * as paid. A price with neither an order nor a credit has no payment record, so it is pending,
 * never paid. Older bookings were created before payment was confirmed, so the stored price on
 * the booking alone does not prove anything was received.
 */
export const paymentStatusExpr = sql`
  CASE
    WHEN b.order_id IS NOT NULL THEN
      CASE b.order_status
        WHEN 'completed' THEN 'paid'
        WHEN 'pending' THEN 'pending'
        WHEN 'refunded' THEN 'refunded'
        ELSE 'failed'
      END
    WHEN b.credit_kind IS NOT NULL THEN 'credit'
    WHEN b.amount > 0 THEN 'pending'
    ELSE 'free'
  END
`;

/* What was actually received for a booking: its price when paid (or paid and later refunded), else 0. */
export const amountReceivedExpr = sql`
  CASE WHEN (${paymentStatusExpr}) IN ('paid', 'refunded', 'credit') THEN b.amount ELSE 0 END
`;

export type BookingSqlRow = {
  type: LiveSessionKind;
  id: string;
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
  durationMinutes: number;
  status: string;
  sessionStatus: string;
  amount: string | number;
  orderId: number | null;
  orderStatus: string | null;
  paymentMethod: string | null;
  paymentTransactionId: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  refundReason: string | null;
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
  paymentStatus: LivePaymentStatus;
  amountReceived: string | number;
  totalCount?: string | number;
};

/* ILIKE pattern for free text, with LIKE wildcards in the input escaped. */
export function containsPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function andAll(conds: RawBuilder<unknown>[]): RawBuilder<unknown> {
  return conds.length ? sql.join(conds, sql` AND `) : sql`TRUE`;
}
