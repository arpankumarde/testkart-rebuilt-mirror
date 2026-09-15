import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { deleteFromR2 } from "../../../helpers/r2Client";

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
    const { lessonId } = schema.parse(json);

    const isOwner = await checkLessonOwnership(lessonId, effectiveTeacherId, user.role);
    if (!isOwner) {
        return new Response(superjson.stringify({ error: "You do not own this course lesson" }), { status: 403 });
    }

    // Fetch the lesson to get contentFileId before deletion
    console.log(`Fetching lesson ${lessonId} for deletion`);
    const lesson = await db.selectFrom("courseLessons")
      .select(["id", "contentFileId"])
      .where("id", "=", lessonId)
      .executeTakeFirst();

    if (!lesson) {
      console.log(`Lesson ${lessonId} not found`);
      return new Response(superjson.stringify({ error: "Lesson not found" }), { status: 404 });
    }

    // If contentFileId exists, try to delete it from ImageKit
    if (lesson.contentFileId) {
      console.log(`Attempting to delete ImageKit file: ${lesson.contentFileId}`);
      try {
        await deleteFromR2(lesson.contentFileId);
        console.log(`Successfully deleted ImageKit file: ${lesson.contentFileId}`);
      } catch (error) {
        // Log the error but don't block the database deletion
        console.error(`Failed to delete R2 file ${lesson.contentFileId}:`, error);
        console.log("Continuing with database deletion despite ImageKit deletion failure");
      }
    } else {
      console.log(`No contentFileId found for lesson ${lessonId}, skipping ImageKit deletion`);
    }

    // Delete the lesson from the database
    console.log(`Deleting lesson ${lessonId} from database`);
    await db.deleteFrom("courseLessons").where("id", "=", lessonId).execute();
    console.log(`Successfully deleted lesson ${lessonId}`);

    return new Response(superjson.stringify({ success: true } satisfies OutputType));

  } catch (error) {
    console.error("Error deleting course lesson:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to delete lesson", details: errorMessage }), { status: 500 });
  }
}