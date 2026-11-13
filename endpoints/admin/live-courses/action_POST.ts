import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { actorStamp, recordSessionEvent, type LiveActor } from "../../../helpers/liveSessionLifecycle";
import {
  LiveCourseError,
  cancelWholeCourse,
  errorResponse,
  refundLiveCourseEnrollment,
  syncCourseDates,
} from "../../../helpers/liveCourseServer";
import { sendClassChangeNotices, sendRefundNotices } from "../../../helpers/liveCourseNotices";
import { schema, type OutputType } from "./action_POST.schema";

/** Admin actions on a live course. Admin edits never publish or unpublish. */
export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const actor: LiveActor = { type: "admin", id: admin.id, label: admin.fullName ?? admin.email ?? String(admin.id) };
    const by = actorStamp(actor);
    let message = "Done.";

    if (input.action === "update") {
      const d = input.details;
      const course = await db.selectFrom("liveCourses").select(["id", "enrolledCount", "status"]).where("id", "=", input.courseId).executeTakeFirst();
      if (!course) throw new LiveCourseError("Live course not found.", 404);
      if (d.seatLimit < course.enrolledCount) throw new LiveCourseError(`Seats cannot go below the ${course.enrolledCount} enrolled.`);
      let examName: string | null = null;
      if (d.examId) {
        const exam = await db.selectFrom("exams").select("examName").where("id", "=", d.examId).executeTakeFirst();
        if (!exam) throw new LiveCourseError("That exam was not found.");
        examName = exam.examName;
      }
      await db
        .updateTable("liveCourses")
        .set({
          title: d.title,
          description: d.description,
          thumbnailUrl: d.thumbnailUrl ?? null,
          thumbnailFileId: d.thumbnailFileId ?? null,
          examId: d.examId ?? null,
          examName,
          languages: d.languages,
          level: d.level,
          price: d.price.toFixed(2),
          originalPrice: d.originalPrice == null ? null : d.originalPrice.toFixed(2),
          seatLimit: d.seatLimit,
          registrationDeadline: d.registrationDeadline ?? null,
          defaultClassMinutes: d.defaultClassMinutes,
          updatedAt: new Date(),
        })
        .where("id", "=", course.id)
        .execute();
      message = "Saved.";
    }

    if (input.action === "cancel_course") {
      const students = await db
        .selectFrom("liveCourseEnrollments")
        .select(["id", "studentId"])
        .where("liveCourseId", "=", input.courseId)
        .where("status", "=", "enrolled")
        .execute();
      const outcome = await cancelWholeCourse({ courseId: input.courseId, reason: input.reason, by });
      for (const r of outcome.refunded) {
        const s = students.find((x) => x.id === r.enrollmentId);
        if (s) await sendRefundNotices(input.courseId, s.studentId, r.amount, `The course was cancelled: ${input.reason}`);
      }
      message = `Course cancelled. ${outcome.refunded.length} refunded${outcome.failed.length ? `, ${outcome.failed.length} refund(s) failed: ${outcome.failed.map((f) => f.error).join("; ")}` : ""}.`;
    }

    if (input.action === "refund") {
      const enrollment = await db
        .selectFrom("liveCourseEnrollments")
        .select(["liveCourseId", "studentId"])
        .where("id", "=", input.enrollmentId)
        .executeTakeFirst();
      if (!enrollment) throw new LiveCourseError("Enrolment not found.", 404);
      const outcome = await refundLiveCourseEnrollment({ enrollmentId: input.enrollmentId, by, force: true });
      await sendRefundNotices(enrollment.liveCourseId, enrollment.studentId, outcome.amount, input.reason);
      message = `Refund of Rs ${outcome.amount} started (${outcome.refundStatus}).`;
    }

    if (input.action === "cancel_class") {
      const cls = await db.selectFrom("groupLessons").selectAll().where("id", "=", input.classId).executeTakeFirst();
      if (!cls?.liveCourseId) throw new LiveCourseError("Class not found.", 404);
      if (cls.status !== "scheduled") throw new LiveCourseError(`This class is already ${cls.status}.`);
      const courseId = cls.liveCourseId;
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable("groupLessons")
          .set({ status: "cancelled", cancellationReason: input.reason, cancelledAt: new Date(), cancelledBy: by, updatedAt: new Date() })
          .where("id", "=", cls.id)
          .execute();
        await recordSessionEvent(trx, { kind: "group", id: cls.id, from: "scheduled", to: "cancelled", actor, reason: input.reason });
        await syncCourseDates(trx, courseId);
      });
      const course = await db.selectFrom("liveCourses").select("status").where("id", "=", courseId).executeTakeFirst();
      if (course?.status === "published") {
        await sendClassChangeNotices(courseId, [{ kind: "cancelled", title: cls.title, startTime: cls.startTime, reason: input.reason }]);
      }
      message = "Class cancelled.";
    }

    const output: OutputType = { message };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live course action failed:", error);
    const { status, message } = errorResponse(error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
