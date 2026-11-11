import type { AttendeeSqlRow, SessionSqlRow } from "./adminLiveLessonsSql";
import type { LiveCalendarEvent } from "../endpoints/admin/live-lessons/calendar_GET.schema";
import type { LiveAttendeeRow } from "../endpoints/admin/live-lessons/session_GET.schema";

/* Server-side mappers from the admin Live Lessons SQL rows to the wire shapes. */

const toDate = (v: Date | string | null | undefined) => (v ? new Date(v) : null);

export function toLiveSession(r: SessionSqlRow): LiveCalendarEvent {
  const start = new Date(r.startTime);
  return {
    kind: r.kind,
    id: r.id,
    title: r.title,
    teacherId: r.teacherId,
    teacherName: r.teacherName,
    teacherAvatarUrl: r.teacherAvatarUrl,
    studentName: r.studentName,
    start,
    end: new Date(start.getTime() + r.durationMinutes * 60000),
    durationMinutes: r.durationMinutes,
    status: r.status,
    unmarked: !!r.unmarked,
    studentCount: Number(r.studentCount ?? 0),
    maxCapacity: r.maxCapacity,
    price: Number(r.price ?? 0),
    isTrial: !!r.isTrial,
    cancellationReason: r.cancellationReason,
  };
}

export function toLiveAttendee(r: AttendeeSqlRow): LiveAttendeeRow {
  return {
    type: r.type,
    id: r.id,
    sessionId: r.sessionId,
    studentId: r.studentId,
    studentName: r.studentName,
    studentEmail: r.studentEmail,
    bookedAt: toDate(r.bookedAt),
    price: Number(r.amount ?? 0),
    amountPaid: Number(r.amountReceived ?? 0),
    paymentStatus: r.paymentStatus,
    orderId: r.orderId,
    orderStatus: r.orderStatus,
    paymentMethod: r.paymentMethod,
    paidAt: toDate(r.paidAt),
    refundedAt: toDate(r.refundedAt),
    creditKind: r.creditKind,
    isTrial: !!r.isTrial,
    attendance: r.attendance,
    attendanceBasis: r.attendanceBasis,
    attendanceMarkedBy: r.attendanceMarkedBy,
    attendanceMarkedAt: toDate(r.attendanceMarkedAt),
    canMark: !r.placeCancelled && !!r.started,
  };
}