import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./cancel_POST.schema";
import { sendEmail } from "../../../helpers/sendEmail";
import { emailTemplatesExtra } from "../../../helpers/emailTemplatesExtra";
import { lifecycleStatusOf, recordSessionEvent } from "../../../helpers/liveSessionLifecycle";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const lesson = await db
      .selectFrom("groupLessons")
      .innerJoin("users as teacher", "teacher.id", "groupLessons.teacherId")
      .select([
        "groupLessons.id",
        "groupLessons.teacherId",
        "groupLessons.title",
        "groupLessons.startTime",
        "groupLessons.durationMinutes",
        "groupLessons.status",
        "teacher.displayName as teacherName",
      ])
      .where("groupLessons.id", "=", input.id)
      .executeTakeFirst();

    if (!lesson || (lesson.teacherId !== effectiveTeacherId && user.role !== "admin")) {
      return new Response(superjson.stringify({ error: "Group lesson not found" }), { status: 404 });
    }
    if (lesson.status === "cancelled" || lesson.status === "completed") {
      return new Response(superjson.stringify({ error: `This lesson is already ${lesson.status}.` }), { status: 400 });
    }

    const byAdmin = user.role === "admin";
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("groupLessons")
        .set({
          status: "cancelled",
          cancellationReason: input.reason,
          cancelledAt: new Date(),
          cancelledBy: byAdmin ? "admin" : "teacher",
          updatedAt: new Date(),
        })
        .where("id", "=", input.id)
        .execute();
      await recordSessionEvent(trx, {
        kind: "group",
        id: input.id,
        from: lifecycleStatusOf(lesson.status, lesson.startTime, lesson.durationMinutes),
        to: "cancelled",
        actor: { type: byAdmin ? "admin" : "teacher", id: user.id, label: user.displayName ?? null },
        reason: input.reason,
      });
    });

    const enrolled = await db
      .selectFrom("groupLessonEnrollments")
      .innerJoin("users as student", "student.id", "groupLessonEnrollments.studentId")
      .select(["student.email as email", "student.displayName as name"])
      .where("groupLessonEnrollments.groupLessonId", "=", input.id)
      .where("groupLessonEnrollments.status", "=", "enrolled")
      .execute();

    try {
      await Promise.all(
        enrolled
          .filter((s) => !!s.email)
          .map((s) => {
            const tmpl = emailTemplatesExtra.groupLessonCancelled(s.name, lesson.teacherName, lesson.title, lesson.startTime, input.reason);
            return sendEmail({ to: s.email as string, ...tmpl });
          })
      );
    } catch (emailError) {
      console.error("Failed to send group lesson cancellation emails:", emailError);
    }

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error cancelling group lesson:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
