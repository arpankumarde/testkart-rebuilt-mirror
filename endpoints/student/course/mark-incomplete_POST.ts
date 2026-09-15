import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./mark-incomplete_POST.schema";
import superjson from "superjson";
import { Transaction } from "kysely";
import { DB } from "../../../helpers/schema";

async function recalculateAndUpdateProgress(trx: Transaction<DB>, courseId: number, enrollmentId: number): Promise<number> {
    const totalLessonsResult = await trx
        .selectFrom("courseLessons")
        .innerJoin("courseSections", "courseSections.id", "courseLessons.sectionId")
        .select(trx.fn.count("courseLessons.id").as("count"))
        .where("courseSections.courseId", "=", courseId)
        .executeTakeFirstOrThrow();
    const totalLessons = Number(totalLessonsResult.count);

    if (totalLessons === 0) {
        await trx.updateTable("courseEnrollments")
            .set({ completionPercentage: 0 })
            .where("id", "=", enrollmentId)
            .execute();
        return 0;
    }

    const completedLessonsResult = await trx
        .selectFrom("courseProgress")
        .select(trx.fn.count("id").as("count"))
        .where("enrollmentId", "=", enrollmentId)
        .executeTakeFirstOrThrow();
    const completedLessons = Number(completedLessonsResult.count);
    
    const percentage = (completedLessons / totalLessons) * 100;
    const roundedPercentage = Math.round(percentage);

    await trx.updateTable("courseEnrollments")
        .set({ completionPercentage: roundedPercentage })
        .where("id", "=", enrollmentId)
        .execute();
    
    return roundedPercentage;
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== 'student') {
        return new Response(superjson.stringify({ error: "Only students can perform this action" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const { lessonId } = schema.parse(json);

    const lesson = await db
      .selectFrom("courseLessons")
      .innerJoin("courseSections", "courseSections.id", "courseLessons.sectionId")
      .select("courseSections.courseId")
      .where("courseLessons.id", "=", lessonId)
      .executeTakeFirst();

    if (!lesson) {
      return new Response(superjson.stringify({ error: "Lesson not found" }), { status: 404 });
    }

    const enrollment = await db
      .selectFrom("courseEnrollments")
      .select("id")
      .where("courseId", "=", lesson.courseId)
      .where("studentId", "=", user.id)
      .executeTakeFirst();

    if (!enrollment) {
      return new Response(superjson.stringify({ error: "Not enrolled in this course" }), { status: 403 });
    }

    const newCompletionPercentage = await db.transaction().execute(async (trx) => {
        await trx
            .deleteFrom("courseProgress")
            .where("enrollmentId", "=", enrollment.id)
            .where("lessonId", "=", lessonId)
            .execute();

        return await recalculateAndUpdateProgress(trx, lesson.courseId, enrollment.id);
    });

    return new Response(superjson.stringify({ 
        success: true, 
        completionPercentage: newCompletionPercentage,
    } satisfies OutputType));
  } catch (error) {
    console.error("Failed to mark lesson incomplete:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to update progress", details: errorMessage }), { status: 500 });
  }
}