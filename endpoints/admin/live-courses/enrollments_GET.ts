import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, ENROLLMENTS_LIMIT, SETTLED_REFUND_STATUSES, type OutputType } from "./enrollments_GET.schema";

/* Every live course enrolment across courses, newest first, for the admin enrolments and refunds tab. */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));

    let q = db
      .selectFrom("liveCourseEnrollments as e")
      .innerJoin("liveCourses as lc", "lc.id", "e.liveCourseId")
      .innerJoin("students as s", "s.id", "e.studentId")
      .innerJoin("teachers as t", "t.id", "lc.teacherId")
      .select([
        "e.id",
        "e.status",
        "e.amountPaid",
        "e.enrolledAt",
        "e.orderId",
        "e.refundAmount",
        "e.refundStatus",
        "e.refundRequestedAt",
        "e.refundedAt",
        "s.id as studentId",
        "s.displayName as studentName",
        "s.email as studentEmail",
        "lc.id as courseId",
        "lc.title as courseTitle",
        "lc.status as courseStatus",
        "t.displayName as teacherName",
      ]);

    if (input.filter === "enrolled") q = q.where("e.status", "=", "enrolled");
    if (input.filter === "refunded") q = q.where("e.status", "=", "refunded");
    if (input.filter === "refund_open") {
      q = q
        .where("e.status", "=", "refunded")
        .where((eb) => eb.or([eb("e.refundStatus", "is", null), eb("e.refundStatus", "not in", [...SETTLED_REFUND_STATUSES])]));
    }
    if (input.q) {
      const like = `%${input.q.replace(/[%_\\]/g, "\\$&")}%`;
      const orderId = /^\d{1,9}$/.test(input.q) ? Number(input.q) : null;
      q = q.where((eb) =>
        eb.or([
          eb("s.displayName", "ilike", like),
          eb("s.email", "ilike", like),
          eb("lc.title", "ilike", like),
          eb("t.displayName", "ilike", like),
          ...(orderId ? [eb("e.orderId", "=", orderId)] : []),
        ])
      );
    }

    const rows = await q
      .orderBy(input.filter === "refund_open" || input.filter === "refunded" ? "e.refundRequestedAt" : "e.enrolledAt", "desc")
      .limit(ENROLLMENTS_LIMIT + 1)
      .execute();

    const output: OutputType = {
      truncated: rows.length > ENROLLMENTS_LIMIT,
      enrollments: rows.slice(0, ENROLLMENTS_LIMIT).map((r) => ({
        id: r.id,
        status: r.status as "enrolled" | "refunded" | "removed",
        amountPaid: Number(r.amountPaid),
        enrolledAt: r.enrolledAt,
        orderId: r.orderId,
        refundAmount: r.refundAmount === null ? null : Number(r.refundAmount),
        refundStatus: r.refundStatus,
        refundRequestedAt: r.refundRequestedAt,
        refundedAt: r.refundedAt,
        student: { id: r.studentId, name: r.studentName?.trim() || `Student #${r.studentId}`, email: r.studentEmail },
        course: { id: r.courseId, title: r.courseTitle, status: r.courseStatus },
        teacherName: r.teacherName?.trim() || "Teacher",
      })),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live course enrolments failed:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Could not load enrolments." }), { status: 400 });
  }
}
