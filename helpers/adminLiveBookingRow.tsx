import type { BookingSqlRow } from "./adminLiveLessonsSql";
import type { LiveBookingRow } from "../endpoints/admin/live-lessons/bookings_GET.schema";

const toDate = (v: Date | string | null | undefined) => (v ? new Date(v) : null);

/* Server-side mapper from a bookingsSource row to the wire shape. */
export function toLiveBookingRow(r: BookingSqlRow): LiveBookingRow {
  const sessionStart = new Date(r.sessionStart);
  return {
    type: r.type,
    id: r.id,
    sessionId: r.sessionId,
    studentId: r.studentId,
    studentName: r.studentName,
    studentEmail: r.studentEmail,
    teacherId: r.teacherId,
    teacherName: r.teacherName,
    teacherAvatarUrl: r.teacherAvatarUrl,
    sessionTitle: r.sessionTitle,
    bookedAt: toDate(r.bookedAt),
    sessionStart,
    sessionEnd: new Date(sessionStart.getTime() + r.durationMinutes * 60000),
    durationMinutes: r.durationMinutes,
    status: r.status,
    sessionStatus: r.sessionStatus,
    price: Number(r.amount ?? 0),
    amountPaid: Number(r.amountReceived ?? 0),
    paymentStatus: r.paymentStatus,
    orderId: r.orderId,
    orderStatus: r.orderStatus,
    paymentMethod: r.paymentMethod,
    paymentTransactionId: r.paymentTransactionId,
    paidAt: toDate(r.paidAt),
    refundedAt: toDate(r.refundedAt),
    refundReason: r.refundReason,
    creditKind: r.creditKind,
    isTrial: !!r.isTrial,
    fromPackage: !!r.fromPackage,
    cancellationReason: r.cancellationReason,
    cancelledBy: r.cancelledBy,
    cancelledAt: toDate(r.cancelledAt),
    issueReportedAt: toDate(r.issueReportedAt),
    issueNote: r.issueNote,
    issueResolution: r.issueResolution,
    issueResolvedAt: toDate(r.issueResolvedAt),
    maxCapacity: r.maxCapacity,
    enrolledCount: r.enrolledCount,
  };
}