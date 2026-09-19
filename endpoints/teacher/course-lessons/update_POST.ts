import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { sanitizeOptionalHtml } from "../../../helpers/sanitizeHtml";
import { syncLessonVideoToGumlet } from "../../../helpers/syncLessonVideoToGumlet";

async function checkLessonOwnership(lessonId: number, teacherId: number, userRole: string): Promise<boolean> {
    if (userRole === 'admin') return true;
    const lesson = await db.selectFrom("courseLessons")
        .innerJoin("courseSections", "courseSections.id", "courseLessons.sectionId")
        .innerJoin("courses", "courses.id", "courseSections.courseId")
        .select("courses.teacherId")
        .where("courseLessons.id", "=", lessonId)
        .executeTakeFirst();
    return !!lesson && lesson.teacherId === teacherId;
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    const { lessonId, ...updateData } = input;

    const isOwner = await checkLessonOwnership(lessonId, effectiveTeacherId, user.role);
    if (!isOwner) {
        return new Response(superjson.stringify({ error: "You do not own this course lesson" }), { status: 403 });
    }

    const updatedLesson = await db.updateTable("courseLessons")
        .set({
            ...updateData,
            textContent: sanitizeOptionalHtml(updateData.textContent),
            updatedAt: new Date(),
        })
        .where("id", "=", lessonId)
        .returningAll()
        .executeTakeFirstOrThrow();

    await syncLessonVideoToGumlet(lessonId);

    return new Response(superjson.stringify(updatedLesson satisfies OutputType));

  } catch (error) {
    console.error("Error updating course lesson:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to update lesson", details: errorMessage }), { status: 500 });
  }
}