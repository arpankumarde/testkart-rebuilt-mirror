import { sql, type RawBuilder } from "kysely";
import { COMPLETION_OVERDUE_HOURS } from "./liveLessonConfig";

/*
 * Server-only SQL sources for the admin Live Lessons module.
 *
 * A "session" is something that happens on the calendar: a 1:1 mentorship booking or a group
 * lesson. A "booking" is one learner's place in a session: a 1:1 mentorship booking or a group
 * lesson enrollment. A 1:1 booking is therefore both, with the same id.
 *
 * mentorship_bookings stores UTC wall-clock times in timestamp-without-time-zone columns, so they
 * are converted with AT TIME ZONE 'UTC' to line up with group_lessons' timestamptz columns.
 *
 * Status is the lifecycle status: a stored "scheduled" whose end time has passed reads as
 * "awaiting_completion", and is "overdue" once COMPLETION_OVERDUE_HOURS more have gone by.
 */

export const SESSION_KINDS = ["booking", "group"] as const;
export type LiveSessionKind = (typeof SESSION_KINDS)[number];

export const SESSION_STATUSES = ["scheduled", "awaiting_completion", "completed", "cancelled", "no_show"] as const;

const mbEnd = sql`((mb.scheduled_at AT TIME ZONE 'UTC') + make_interval(mins => mb.duration_minutes))`;
const glEnd = sql`(gl.start_time + make_interval(mins => gl.duration_minutes))`;
const lifecycle = (stored: RawBuilder<unknown>, end: RawBuilder<unknown>) =>
  sql`CASE WHEN ${stored} = 'scheduled' AND ${end} <= now() THEN 'awaiting_completion' ELSE ${stored} END`;
const overdueWhen = (stored: RawBuilder<unknown>, end: RawBuilder<unknown>) =>
  sql`(${stored} = 'scheduled' AND ${end} + make_interval(hours => ${sql.lit(COMPLETION_OVERDUE_HOURS)}) <= now())`;
const mbStored = sql`coalesce(mb.status::text, 'scheduled')`;
const glStored = sql`gl.status::text`;

/*
 * The calendar shows a session only when its teacher's live teaching application is approved
 * (users.live_teaching_status). Sessions have no approval of their own. Bookings do not use this.
 */
export const approvedTeacherOnly = sql`s.teacher_live_status = 'approved'`;

export const PAYMENT_STATUSES = ["paid", "pending", "refunded", "failed", "credit", "free", "none"] as const;
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
    ${lifecycle(mbStored, mbEnd)} AS status,
    NULL::int AS enrolled_count,
    NULL::int AS max_capacity,
    coalesce(mb.amount_paid, 0) AS price,
    coalesce(mb.is_trial, false) AS is_trial,
    mb.cancellation_reason,
    ${overdueWhen(mbStored, mbEnd)} AS overdue,
    mb.no_show_party,
    mb.no_show_reason,
    mb.completed_at,
    mb.completed_by,
    (mb.cancelled_at AT TIME ZONE 'UTC') AS cancelled_at,
    mb.cancelled_by
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
    ${lifecycle(glStored, glEnd)},
    gl.enrolled_count,
    gl.max_capacity,
    coalesce(gl.price_per_learner, 0),
    false,
    gl.cancellation_reason,
    ${overdueWhen(glStored, glEnd)},
    NULL,
    NULL,
    gl.completed_at,
    gl.completed_by,
    gl.cancelled_at,
    gl.cancelled_by
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
  overdue: boolean;
  noShowParty: string | null;
  noShowReason: string | null;
  completedAt: Date | null;
  completedBy: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
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
    ${lifecycle(mbStored, mbEnd)} AS status,
    ${lifecycle(mbStored, mbEnd)} AS session_status,
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
    NULL::int AS enrolled_count,
    false AS no_learners,
    mb.no_show_party,
    mb.no_show_reason,
    mb.completed_at,
    mb.completed_by,
    ${overdueWhen(mbStored, mbEnd)} AS overdue
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
      WHEN ${glEnd} <= now() THEN 'awaiting_completion'
      ELSE 'scheduled'
    END,
    ${lifecycle(glStored, glEnd)},
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
    CASE
      WHEN e.status = 'removed' OR coalesce(e.removed_by_teacher, false) THEN 'teacher'
      WHEN e.status = 'cancelled' THEN 'learner'
      WHEN gl.status::text = 'cancelled' THEN gl.cancelled_by
    END,
    coalesce(e.cancelled_at, CASE WHEN gl.status::text = 'cancelled' THEN gl.cancelled_at END),
    NULL::timestamptz,
    NULL::text,
    NULL::text,
    NULL::timestamptz,
    gl.max_capacity,
    gl.enrolled_count,
    false,
    NULL,
    NULL,
    gl.completed_at,
    gl.completed_by,
    (e.status NOT IN ('cancelled', 'removed') AND ${overdueWhen(glStored, glEnd)})
  FROM group_lesson_enrollments e
  JOIN group_lessons gl ON gl.id = e.group_lesson_id
  JOIN users t ON t.id = gl.teacher_id
  LEFT JOIN users st ON st.id = e.student_id
  LEFT JOIN orders o ON o.id = e.order_id
`;

/*
 * The Bookings history: every learner booking, plus one learner-less row for each group lesson
 * cancelled before anyone enrolled, so a cancelled session is never missing from the list. Its id
 * is the lesson id. Session drawers keep bookingsSource, which holds real learner bookings only.
 */
export const bookingsHistorySource = sql`
  ${bookingsSource}
  UNION ALL
  SELECT
    'group'::text,
    gl.id::text,
    gl.id::text,
    NULL,
    NULL,
    NULL,
    gl.teacher_id,
    t.display_name,
    t.avatar_url,
    gl.title,
    NULL,
    gl.start_time,
    gl.duration_minutes,
    'cancelled',
    gl.status::text,
    coalesce(gl.price_per_learner, 0),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    false,
    false,
    gl.cancellation_reason,
    gl.cancelled_by,
    gl.cancelled_at,
    NULL,
    NULL,
    NULL,
    NULL,
    gl.max_capacity,
    gl.enrolled_count,
    true,
    NULL,
    NULL,
    NULL,
    NULL,
    false
  FROM group_lessons gl
  JOIN users t ON t.id = gl.teacher_id
  WHERE gl.status = 'cancelled'
    AND NOT EXISTS (SELECT 1 FROM group_lesson_enrollments e WHERE e.group_lesson_id = gl.id)
`;

/*
 * Payment state of a booking row. The order decides when there is one: completed is paid, and a
 * failed, cancelled or never-finished order is not. Without an order, a live class credit counts
 * as paid. A price with neither an order nor a credit has no payment record, so it is pending,
 * never paid. Older bookings were created before payment was confirmed, so the stored price on
 * the booking alone does not prove anything was received. A learner-less row has no payment.
 */
export const paymentStatusExpr = sql`
  CASE
    WHEN b.no_learners THEN 'none'
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
  noLearners: boolean;
  noShowParty: string | null;
  noShowReason: string | null;
  completedAt: Date | null;
  completedBy: string | null;
  overdue: boolean;
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
