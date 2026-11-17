import { db } from "./db";
import type { OutputType } from "../endpoints/teacher/live-courses/students_GET.schema";

/** Roster, started classes and attendance marks of one live course (teacher and admin views). */
export async function loadCourseRoster(courseId: string): Promise<OutputType> {
  const [students, classes] = await Promise.all([
    db
      .selectFrom("liveCourseEnrollments")
      .innerJoin("students", "students.id", "liveCourseEnrollments.studentId")
      .select([
        "liveCourseEnrollments.id as enrollmentId",
        "students.id as studentId",
        "students.displayName as name",
        "students.avatarUrl as avatarUrl",
        "students.email as email",
        "liveCourseEnrollments.status",
        "liveCourseEnrollments.amountPaid",
        "liveCourseEnrollments.enrolledAt",
        "liveCourseEnrollments.refundedAt",
        "liveCourseEnrollments.refundStatus",
      ])
      .where("liveCourseEnrollments.liveCourseId", "=", courseId)
      .orderBy("liveCourseEnrollments.enrolledAt", "asc")
      .execute(),
    db
      .selectFrom("groupLessons")
      .select(["id", "title", "startTime", "status"])
      .where("liveCourseId", "=", courseId)
      .where("startTime", "<=", new Date())
      .where((eb) => eb.or([eb("status", "!=", "cancelled"), eb("missedAt", "is not", null)]))
      .orderBy("startTime", "asc")
      .execute(),
  ]);
  const marks = classes.length
    ? await db
        .selectFrom("liveCourseAttendance")
        .select(["groupLessonId as classId", "studentId", "present", "source"])
        .where("groupLessonId", "in", classes.map((c) => c.id))
        .execute()
    : [];
  return {
    students: students.map((s) => ({
      ...s,
      status: s.status as "enrolled" | "refunded" | "removed",
      amountPaid: Number(s.amountPaid),
    })),
    classes,
    attendance: marks.map((m) => ({ ...m, source: m.source as "auto" | "teacher" })),
  };
}
