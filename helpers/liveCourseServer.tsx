import type { Kysely, Selectable } from "kysely";
import { db } from "./db";
import type { DB, LiveCourses, Users } from "./schema";
import { createCashfreeRefund } from "./cashfree";
import { LIVE_COURSE_REFUND_CLOSES_AT_CLASS, liveCourseSlugBase } from "./liveCourseRules";

/*
 * Server-only live course logic. A live course owns its classes as group_lessons rows
 * (live_course_id), so the classroom, Daily rooms, chat and the teacher's shared calendar work for
 * them unchanged. Live course sales credit no teacher earnings until a payout model is decided.
 */

type Exec = Kysely<DB>;
export type LiveCourseRow = Selectable<LiveCourses>;

export class LiveCourseError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const errorResponse = (error: unknown, fallback = "Something went wrong.") => {
  const status = error instanceof LiveCourseError ? error.status : 400;
  const message = error instanceof Error ? error.message : fallback;
  return { status, message };
};

type SessionUser = Pick<Selectable<Users>, "id" | "role">;

/** Teachers need an approved live teaching application to create or publish a live course. */
export async function assertApprovedLiveTeacher(user: SessionUser, teacherId: number): Promise<void> {
  if (user.role === "admin") return;
  if (user.role !== "teacher") throw new LiveCourseError("Only teachers can manage live courses.", 403);
  const row = await db.selectFrom("users").select("liveTeachingStatus").where("id", "=", teacherId).executeTakeFirst();
  if (row?.liveTeachingStatus !== "approved") {
    throw new LiveCourseError("Live courses open once your live teaching application is approved.", 403);
  }
}

/** The course if this teacher (or a team member acting for them) or an admin may manage it. */
export async function getManagedCourse(
  courseId: string,
  user: SessionUser,
  effectiveTeacherId: number,
  exec: Exec = db
): Promise<LiveCourseRow> {
  if (user.role !== "teacher" && user.role !== "admin") throw new LiveCourseError("Unauthorized", 403);
  const course = await exec.selectFrom("liveCourses").selectAll().where("id", "=", courseId).executeTakeFirst();
  if (!course || (user.role !== "admin" && course.teacherId !== effectiveTeacherId)) {
    throw new LiveCourseError("Live course not found.", 404);
  }
  return course;
}

export async function uniqueLiveCourseSlug(title: string, excludeId?: string, exec: Exec = db): Promise<string> {
  const base = liveCourseSlugBase(title);
  let q = exec.selectFrom("liveCourses").select("slug").where("slug", "like", `${base}%`);
  if (excludeId) q = q.where("id", "!=", excludeId);
  const taken = new Set((await q.execute()).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Keeps starts_on / ends_on equal to the first class start and the last class end. */
export async function syncCourseDates(exec: Exec, courseId: string): Promise<void> {
  const classes = await exec
    .selectFrom("groupLessons")
    .select(["startTime", "durationMinutes"])
    .where("liveCourseId", "=", courseId)
    .where("status", "!=", "cancelled")
    .orderBy("startTime", "asc")
    .execute();
  const first = classes[0];
  const last = classes.reduce<Date | null>((acc, c) => {
    const end = new Date(new Date(c.startTime).getTime() + c.durationMinutes * 60000);
    return !acc || end > acc ? end : acc;
  }, null);
  await exec
    .updateTable("liveCourses")
    .set({ startsOn: first ? first.startTime : null, endsOn: last, updatedAt: new Date() })
    .where("id", "=", courseId)
    .execute();
}

/**
 * When the refund guarantee closes: the start of the 3rd class that is not cancelled. Null while
 * the course has fewer classes than that, which keeps the window open.
 */
export async function refundClosesAt(courseId: string, exec: Exec = db): Promise<Date | null> {
  const row = await exec
    .selectFrom("groupLessons")
    .select("startTime")
    .where("liveCourseId", "=", courseId)
    .where("status", "!=", "cancelled")
    .orderBy("startTime", "asc")
    .offset(LIVE_COURSE_REFUND_CLOSES_AT_CLASS - 1)
    .limit(1)
    .executeTakeFirst();
  return row ? new Date(row.startTime) : null;
}

export function isRefundable(enrolledAt: Date, closesAt: Date | null, now = new Date()): boolean {
  if (!closesAt) return true;
  return now < closesAt && new Date(enrolledAt) < closesAt;
}

export type RefundOutcome = { enrollmentId: string; amount: number; refundStatus: string };

/**
 * Refunds one enrolment in full through Cashfree and frees the seat. `force` skips the refund
 * window (admins, and a cancelled course). The Cashfree call runs outside any transaction; the
 * refund id is fixed per enrolment, so a retry never refunds twice.
 */
export async function refundLiveCourseEnrollment(args: {
  enrollmentId: string;
  by: string;
  force?: boolean;
}): Promise<RefundOutcome> {
  const row = await db
    .selectFrom("liveCourseEnrollments")
    .innerJoin("orders", "orders.id", "liveCourseEnrollments.orderId")
    .select([
      "liveCourseEnrollments.id",
      "liveCourseEnrollments.liveCourseId",
      "liveCourseEnrollments.status",
      "liveCourseEnrollments.enrolledAt",
      "liveCourseEnrollments.amountPaid",
      "liveCourseEnrollments.refundRequestedAt",
      "orders.id as orderId",
      "orders.paymentMethod",
      "orders.paymentTransactionId",
    ])
    .where("liveCourseEnrollments.id", "=", args.enrollmentId)
    .executeTakeFirst();
  if (!row) throw new LiveCourseError("Enrolment not found.", 404);
  if (row.status !== "enrolled") throw new LiveCourseError("This enrolment was already refunded or removed.");
  if (row.paymentMethod !== "cashfree" || !row.paymentTransactionId) {
    throw new LiveCourseError("This enrolment was not paid through Cashfree, so it cannot be refunded here.");
  }
  if (!args.force) {
    const closesAt = await refundClosesAt(row.liveCourseId);
    if (!isRefundable(row.enrolledAt, closesAt)) {
      throw new LiveCourseError("The refund window closed when the 3rd class started.");
    }
  }

  const claimed = await db
    .updateTable("liveCourseEnrollments")
    .set({ refundRequestedAt: new Date(), refundId: `lc-refund-${row.id}`, updatedAt: new Date() })
    .where("id", "=", row.id)
    .where("status", "=", "enrolled")
    .where((eb) =>
      eb.or([eb("refundRequestedAt", "is", null), eb("refundRequestedAt", "<", new Date(Date.now() - 2 * 60000))])
    )
    .returning("id")
    .executeTakeFirst();
  if (!claimed) throw new LiveCourseError("A refund for this enrolment is already being processed.");

  const amount = Number(row.amountPaid);
  let refund;
  try {
    refund = await createCashfreeRefund({
      cashfreeOrderId: row.paymentTransactionId,
      refundId: `lc-refund-${row.id}`,
      amount,
      note: "Live course refund",
    });
  } catch (error) {
    await db.updateTable("liveCourseEnrollments").set({ refundRequestedAt: null }).where("id", "=", row.id).execute();
    throw new LiveCourseError(`The refund could not be started: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  await db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable("liveCourseEnrollments")
      .set({
        status: "refunded",
        refundStatus: refund.refund_status ?? "PENDING",
        refundAmount: amount.toFixed(2),
        refundedAt: new Date(),
        refundedBy: args.by,
        updatedAt: new Date(),
      })
      .where("id", "=", row.id)
      .where("status", "=", "enrolled")
      .returning("id")
      .executeTakeFirst();
    if (!updated) return;
    await trx
      .updateTable("liveCourses")
      .set((eb) => ({ enrolledCount: eb.fn<number>("greatest", [eb("enrolledCount", "-", 1), eb.val(0)]), updatedAt: new Date() }))
      .where("id", "=", row.liveCourseId)
      .execute();
    await trx
      .updateTable("orders")
      .set({ status: "refunded", updatedAt: new Date() })
      .where("id", "=", row.orderId)
      .where("status", "=", "completed")
      .execute();
  });

  return { enrollmentId: row.id, amount, refundStatus: refund.refund_status ?? "PENDING" };
}

/**
 * Cancels a whole course: every scheduled class is cancelled and every enrolled student refunded
 * in full, whatever the refund window says. Refund failures are returned, not thrown, so one bad
 * payment does not stop the rest.
 */
export async function cancelWholeCourse(args: {
  courseId: string;
  reason: string;
  by: string;
}): Promise<{ refunded: RefundOutcome[]; failed: { enrollmentId: string; error: string }[] }> {
  await db.transaction().execute(async (trx) => {
    const course = await trx.selectFrom("liveCourses").select(["id", "status"]).where("id", "=", args.courseId).forUpdate().executeTakeFirst();
    if (!course) throw new LiveCourseError("Live course not found.", 404);
    if (course.status === "cancelled") throw new LiveCourseError("This live course is already cancelled.");
    await trx
      .updateTable("liveCourses")
      .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: args.by, cancellationReason: args.reason, updatedAt: new Date() })
      .where("id", "=", course.id)
      .execute();
    await trx
      .updateTable("groupLessons")
      .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: args.by, cancellationReason: args.reason, updatedAt: new Date() })
      .where("liveCourseId", "=", course.id)
      .where("status", "=", "scheduled")
      .execute();
  });

  const enrollments = await db
    .selectFrom("liveCourseEnrollments")
    .select("id")
    .where("liveCourseId", "=", args.courseId)
    .where("status", "=", "enrolled")
    .execute();
  const refunded: RefundOutcome[] = [];
  const failed: { enrollmentId: string; error: string }[] = [];
  for (const e of enrollments) {
    try {
      refunded.push(await refundLiveCourseEnrollment({ enrollmentId: e.id, by: args.by, force: true }));
    } catch (error) {
      failed.push({ enrollmentId: e.id, error: error instanceof Error ? error.message : "Refund failed" });
    }
  }
  return { refunded, failed };
}

export type CourseStudent = {
  studentId: number;
  name: string;
  email: string | null;
  mobileNumber: string | null;
};

export async function enrolledStudents(courseId: string, exec: Exec = db): Promise<CourseStudent[]> {
  return exec
    .selectFrom("liveCourseEnrollments")
    .innerJoin("users", "users.id", "liveCourseEnrollments.studentId")
    .select([
      "users.id as studentId",
      "users.displayName as name",
      "users.email as email",
      "users.mobileNumber as mobileNumber",
    ])
    .where("liveCourseEnrollments.liveCourseId", "=", courseId)
    .where("liveCourseEnrollments.status", "=", "enrolled")
    .execute();
}
