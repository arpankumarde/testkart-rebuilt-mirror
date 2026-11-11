import { sql, type RawBuilder } from "kysely";

/*
 * Server-only SQL sources for the admin Live Lessons module.
 *
 * A "session" is something that happens on the calendar: a 1:1 mentorship booking or a group
 * lesson. An "attendee" is one learner's place in a session: the 1:1 booking itself, or a group
 * lesson enrollment. A 1:1 booking is therefore both, with the same id.
 *
 * Two separate statuses, mapped from what is stored:
 *   - Session status (did the teacher hold it): scheduled | completed | missed | cancelled.
 *     A 1:1 learner no-show was held, so it is completed. A 1:1 teacher no-show, and the sweep's
 *     older "The teacher did not join." cancellations, are missed. A group lesson is missed when
 *     missed_at is set (it is stored cancelled so payouts skip it).
 *   - Attendance (did this learner attend): upcoming | attended | missed | cancelled. An admin's
 *     mark wins; then a teacher's learner no-show; then the classroom join record; once the
 *     session has ended without a join it is missed.
 *
 * mentorship_bookings stores UTC wall-clock times in timestamp-without-time-zone columns, so they
 * are converted with AT TIME ZONE 'UTC' to line up with group_lessons' timestamptz columns.
 */

export const SESSION_KINDS = ["booking", "group"] as const;
export type LiveSessionKind = (typeof SESSION_KINDS)[number];

export const SESSION_STATUSES = ["scheduled", "completed", "missed", "cancelled"] as const;
export type LiveSessionStatus = (typeof SESSION_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["upcoming", "attended", "missed", "cancelled"] as const;
export type LiveAttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const PAYMENT_STATUSES = ["paid", "pending", "refunded", "failed", "credit", "free"] as const;
export type LivePaymentStatus = (typeof PAYMENT_STATUSES)[number];

/* The 1:1 cancellation the sweep writes when the teacher never joined, before missed existed. */
export const SWEEP_TEACHER_ABSENT_REASON = "The teacher did not join.";

const mbStart = sql`(mb.scheduled_at AT TIME ZONE 'UTC')`;
const mbEnd = sql`(${mbStart} + make_interval(mins => mb.duration_minutes))`;
const glEnd = sql`(gl.start_time + make_interval(mins => gl.duration_minutes))`;

const mbTeacherMissed = sql`(
  (mb.status = 'no_show' AND mb.no_show_party = 'teacher')
  OR (mb.status = 'cancelled' AND mb.cancelled_by = 'system' AND mb.cancellation_reason = ${sql.lit(SWEEP_TEACHER_ABSENT_REASON)})
)`;

const mbSessionStatus = sql`CASE
  WHEN ${mbTeacherMissed} THEN 'missed'
  WHEN mb.status = 'cancelled' THEN 'cancelled'
  WHEN mb.status IN ('completed', 'no_show') THEN 'completed'
  ELSE 'scheduled'
END`;
const glSessionStatus = sql`CASE WHEN gl.missed_at IS NOT NULL THEN 'missed' ELSE gl.status::text END`;

const mbUnmarked = sql`(coalesce(mb.status::text, 'scheduled') = 'scheduled' AND ${mbEnd} <= now())`;
const glUnmarked = sql`(gl.status::text = 'scheduled' AND ${glEnd} <= now())`;

const mbLearnerJoined = sql`EXISTS (
  SELECT 1 FROM live_lesson_attendance la WHERE la.mentorship_booking_id = mb.id AND la.user_id = mb.student_id
)`;
const glLearnerJoined = sql`EXISTS (
  SELECT 1 FROM live_lesson_attendance la WHERE la.group_lesson_id = gl.id AND la.user_id = e.student_id
)`;

/*
 * The calendar shows a session only when its teacher's live teaching application is approved
 * (users.live_teaching_status). Sessions have no approval of their own. Bookings do not use this.
 */
export const approvedTeacherOnly = sql`s.teacher_live_status = 'approved'`;

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
    ${mbStart} AS start_time,
    mb.duration_minutes,
    ${mbSessionStatus} AS status,
    ${mbUnmarked} AS unmarked,
    1 AS student_count,
    NULL::int AS max_capacity,
    coalesce(mb.amount_paid, 0) AS price,
    coalesce(mb.is_trial, false) AS is_trial,
    CASE WHEN mb.status = 'cancelled' AND NOT ${mbTeacherMissed} THEN mb.cancellation_reason END AS cancellation_reason,
    CASE WHEN mb.status = 'no_show' THEN mb.no_show_reason WHEN ${mbTeacherMissed} THEN mb.cancellation_reason END AS missed_reason,
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
    ${glSessionStatus},
    ${glUnmarked},
    coalesce(gl.enrolled_count, 0),
    gl.max_capacity,
    coalesce(gl.price_per_learner, 0),
    false,
    CASE WHEN gl.status::text = 'cancelled' AND gl.missed_at IS NULL THEN gl.cancellation_reason END,
    CASE WHEN gl.missed_at IS NOT NULL THEN gl.cancellation_reason END,
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
  status: LiveSessionStatus;
  unmarked: boolean;
  studentCount: number | string;
  maxCapacity: number | null;
  price: string | number;
  isTrial: boolean;
  cancellationReason: string | null;
  missedReason: string | null;
  completedAt: Date | null;
  completedBy: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
};

/*
 * Payment state of an attendee. The order decides when there is one: completed is paid, and a
 * failed, cancelled or never-finished order is not. Without an order, a live class credit counts
 * as paid. A price with neither an order nor a credit has no payment record, so it is pending,
 * never paid. Older bookings were created before payment was confirmed, so the stored price on
 * the booking alone does not prove anything was received.
 */
const paymentStatusOf = (orderId: RawBuilder<unknown>, orderStatus: RawBuilder<unknown>, creditKind: RawBuilder<unknown>, amount: RawBuilder<unknown>) => sql`
  CASE
    WHEN ${orderId} IS NOT NULL THEN
      CASE ${orderStatus}
        WHEN 'completed' THEN 'paid'
        WHEN 'pending' THEN 'pending'
        WHEN 'refunded' THEN 'refunded'
        ELSE 'failed'
      END
    WHEN ${creditKind} IS NOT NULL THEN 'credit'
    WHEN ${amount} > 0 THEN 'pending'
    ELSE 'free'
  END`;

const mbPayment = paymentStatusOf(sql`mb.order_id`, sql`o.status::text`, sql`lc.kind`, sql`coalesce(mb.amount_paid, 0)`);
const glPayment = paymentStatusOf(sql`e.order_id`, sql`o.status::text`, sql`NULL::text`, sql`coalesce(e.amount_paid, 0)`);

/* One row per learner place: the 1:1 booking, or a group lesson enrollment. */
export const attendeesSource = sql`
  SELECT
    'booking'::text AS type,
    mb.id::text AS id,
    mb.id::text AS session_id,
    mb.student_id,
    st.display_name AS student_name,
    st.email AS student_email,
    (mb.created_at AT TIME ZONE 'UTC') AS booked_at,
    coalesce(mb.amount_paid, 0) AS amount,
    ${mbPayment} AS payment_status,
    CASE WHEN ${mbPayment} IN ('paid', 'refunded', 'credit') THEN coalesce(mb.amount_paid, 0) ELSE 0 END AS amount_received,
    mb.order_id,
    o.status::text AS order_status,
    o.payment_method,
    o.paid_at,
    o.refunded_at,
    lc.kind AS credit_kind,
    coalesce(mb.is_trial, false) AS is_trial,
    CASE
      WHEN mb.status = 'cancelled' AND NOT ${mbTeacherMissed} THEN 'cancelled'
      WHEN mb.student_attendance IS NOT NULL THEN mb.student_attendance
      WHEN mb.status = 'no_show' AND coalesce(mb.no_show_party, 'learner') = 'learner' THEN 'missed'
      WHEN ${mbLearnerJoined} THEN 'attended'
      WHEN ${mbEnd} <= now() THEN 'missed'
      ELSE 'upcoming'
    END AS attendance,
    CASE
      WHEN mb.status = 'cancelled' AND NOT ${mbTeacherMissed} THEN NULL
      WHEN mb.student_attendance IS NOT NULL THEN 'marked'
      WHEN mb.status = 'no_show' AND coalesce(mb.no_show_party, 'learner') = 'learner' THEN 'teacher'
      WHEN ${mbLearnerJoined} THEN 'classroom'
      WHEN ${mbEnd} <= now() THEN 'no_join'
    END AS attendance_basis,
    mb.attendance_marked_by,
    mb.attendance_marked_at,
    (mb.status = 'cancelled' AND NOT ${mbTeacherMissed}) AS place_cancelled,
    ${mbStart} <= now() AS started
  FROM mentorship_bookings mb
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
    e.enrolled_at,
    coalesce(e.amount_paid, 0),
    ${glPayment},
    CASE WHEN ${glPayment} IN ('paid', 'refunded') THEN coalesce(e.amount_paid, 0) ELSE 0 END,
    e.order_id,
    o.status::text,
    o.payment_method,
    o.paid_at,
    o.refunded_at,
    NULL::text,
    false,
    CASE
      WHEN e.status IN ('cancelled', 'removed') THEN 'cancelled'
      WHEN gl.status::text = 'cancelled' AND gl.missed_at IS NULL THEN 'cancelled'
      WHEN e.attendance IS NOT NULL THEN e.attendance
      WHEN ${glLearnerJoined} THEN 'attended'
      WHEN ${glEnd} <= now() THEN 'missed'
      ELSE 'upcoming'
    END,
    CASE
      WHEN e.status IN ('cancelled', 'removed') OR (gl.status::text = 'cancelled' AND gl.missed_at IS NULL) THEN NULL
      WHEN e.attendance IS NOT NULL THEN 'marked'
      WHEN ${glLearnerJoined} THEN 'classroom'
      WHEN ${glEnd} <= now() THEN 'no_join'
    END,
    e.attendance_marked_by,
    e.attendance_marked_at,
    (e.status IN ('cancelled', 'removed') OR (gl.status::text = 'cancelled' AND gl.missed_at IS NULL)),
    gl.start_time <= now()
  FROM group_lesson_enrollments e
  JOIN group_lessons gl ON gl.id = e.group_lesson_id
  LEFT JOIN users st ON st.id = e.student_id
  LEFT JOIN orders o ON o.id = e.order_id
`;

export type AttendeeSqlRow = {
  type: LiveSessionKind;
  id: string;
  sessionId: string;
  studentId: number | null;
  studentName: string | null;
  studentEmail: string | null;
  bookedAt: Date | null;
  amount: string | number;
  paymentStatus: LivePaymentStatus;
  amountReceived: string | number;
  orderId: number | null;
  orderStatus: string | null;
  paymentMethod: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  creditKind: string | null;
  isTrial: boolean;
  attendance: LiveAttendanceStatus;
  attendanceBasis: "marked" | "teacher" | "classroom" | "no_join" | null;
  attendanceMarkedBy: string | null;
  attendanceMarkedAt: Date | null;
  placeCancelled: boolean;
  started: boolean;
};

/* ILIKE pattern for free text, with LIKE wildcards in the input escaped. */
export function containsPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function andAll(conds: RawBuilder<unknown>[]): RawBuilder<unknown> {
  return conds.length ? sql.join(conds, sql` AND `) : sql`TRUE`;
}
