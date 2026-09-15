import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./mark-complete_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
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

    // Use transaction to ensure atomicity
    const newProgress = await db.transaction().execute(async (trx) => {
        // Mark lesson as complete
        const progress = await trx
            .insertInto("courseProgress")
            .values({ enrollmentId: enrollment.id, lessonId: lessonId })
            .onConflict((oc) => oc.columns(['enrollmentId', 'lessonId']).doNothing())
            .returningAll()
            .executeTakeFirst();

        // Recalculate and update completion percentage
        const totalLessons = await trx
            .selectFrom("courseLessons")
            .innerJoin("courseSections", "courseSections.id", "courseLessons.sectionId")
            .select(trx.fn.count("courseLessons.id").as("count"))
            .where("courseSections.courseId", "=", lesson.courseId)
            .executeTakeFirstOrThrow();

        const completedLessons = await trx
            .selectFrom("courseProgress")
            .select(trx.fn.count("id").as("count"))
            .where("enrollmentId", "=", enrollment.id)
            .executeTakeFirstOrThrow();
        
        const percentage = (Number(completedLessons.count) / Number(totalLessons.count)) * 100;

        await trx.updateTable("courseEnrollments")
            .set({ completionPercentage: Math.round(percentage) })
            .where("id", "=", enrollment.id)
            .execute();
        
        return {
            progress,
            completionPercentage: Math.round(percentage)
        };
    });

    return new Response(superjson.stringify({ 
        success: true, 
        progress: newProgress.progress,
        completionPercentage: newProgress.completionPercentage,
    } satisfies OutputType));
  } catch (error) {
    console.error("Failed to mark lesson complete:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to update progress", details: errorMessage }), { status: 500 });
  }
}