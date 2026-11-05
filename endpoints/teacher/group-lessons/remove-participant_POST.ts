import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./remove-participant_POST.schema";
import { sendEmail } from "../../../helpers/sendEmail";
import { emailTemplatesExtra } from "../../../helpers/emailTemplatesExtra";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const studentInfo = await db.transaction().execute(async (trx) => {
      const lesson = await trx
        .selectFrom("groupLessons")
        .select(["id", "teacherId", "title", "enrolledCount"])
        .where("id", "=", input.groupLessonId)
        .forUpdate()
        .executeTakeFirst();
      if (!lesson || (lesson.teacherId !== effectiveTeacherId && user.role !== "admin")) {
        throw new Error("Group lesson not found");
      }

      const enrollment = await trx
        .selectFrom("groupLessonEnrollments")
        .select(["id", "status"])
        .where("groupLessonId", "=", input.groupLessonId)
        .where("studentId", "=", input.studentId)
        .executeTakeFirst();
      if (!enrollment || enrollment.status !== "enrolled") {
        throw new Error("This student is not currently enrolled.");
      }

      await trx
        .updateTable("groupLessonEnrollments")
        .set({ status: "removed", removedByTeacher: true, cancelledAt: new Date() })
        .where("id", "=", enrollment.id)
        .execute();

      await trx
        .updateTable("groupLessons")
        .set({ enrolledCount: Math.max(0, lesson.enrolledCount - 1) })
        .where("id", "=", input.groupLessonId)
        .execute();

      const student = await trx
        .selectFrom("users")
        .select(["email", "displayName"])
        .where("id", "=", input.studentId)
        .executeTakeFirst();

      return { student, lessonTitle: lesson.title, teacherName: user.displayName };
    });

    try {
      if (studentInfo.student?.email) {
        const tmpl = emailTemplatesExtra.groupLessonRemoved(
          studentInfo.student.displayName,
          studentInfo.teacherName,
          studentInfo.lessonTitle,
          input.reason
        );
        await sendEmail({ to: studentInfo.student.email, ...tmpl });
      }
    } catch (emailError) {
      console.error("Failed to send group lesson removal email:", emailError);
    }

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error removing group lesson participant:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
