import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { deleteFromR2 } from "../../../helpers/r2Client";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { courseId } = schema.parse(json);

    const course = await db
      .selectFrom("courses")
      .select(["teacherId", "status", "thumbnailFileId", "thumbnailImageFileId"])
      .where("id", "=", courseId)
      .executeTakeFirst();

    if (!course) {
      return new Response(
        superjson.stringify({ error: "Course not found" }),
        { status: 404 }
      );
    }

    if (course.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "You do not own this course" }),
        { status: 403 }
      );
    }

    // Check for enrollments before deleting
    const enrollmentCount = await db
      .selectFrom("courseEnrollments")
      .select(db.fn.count("id").as("count"))
      .where("courseId", "=", courseId)
      .executeTakeFirstOrThrow();

    if (Number(enrollmentCount.count) > 0) {
      return new Response(
        superjson.stringify({
          error: "Cannot delete a course with enrolled students. You can archive it instead.",
        }),
        { status: 400 }
      );
    }

    // Collect all ImageKit fileIds to delete
    const fileIdsToDelete: string[] = [];

    // Get course thumbnail fileIds
    if (course.thumbnailFileId) {
      fileIdsToDelete.push(course.thumbnailFileId);
    }
    if (course.thumbnailImageFileId) {
      fileIdsToDelete.push(course.thumbnailImageFileId);
    }

    // Get all lesson contentFileIds
    const sectionIds = await db
      .selectFrom("courseSections")
      .select("id")
      .where("courseId", "=", courseId)
      .execute();
    
    const sectionIdList = sectionIds.map(s => s.id);

    if (sectionIdList.length > 0) {
      const lessons = await db
        .selectFrom("courseLessons")
        .select("contentFileId")
        .where("sectionId", "in", sectionIdList)
        .where("contentFileId", "is not", null)
        .execute();
      
      lessons.forEach(lesson => {
        if (lesson.contentFileId) {
          fileIdsToDelete.push(lesson.contentFileId);
        }
      });
    }

    // Delete ImageKit files (gracefully handle failures)
    console.log(`[Course Delete] Attempting to delete ${fileIdsToDelete.length} ImageKit files for course ${courseId}`);
    for (const fileId of fileIdsToDelete) {
      try {
        await deleteFromR2(fileId);
        console.log(`[Course Delete] Successfully deleted ImageKit file: ${fileId}`);
      } catch (error) {
        console.error(`[Course Delete] Failed to delete R2 file ${fileId}:`, error);
        // Continue with other deletions - don't block database deletion
      }
    }

    // Use a transaction to delete the course and all its related content
    await db.transaction().execute(async (trx) => {
      if (sectionIdList.length > 0) {
        // Delete lessons
        await trx.deleteFrom("courseLessons").where("sectionId", "in", sectionIdList).execute();
      }
      
      // Delete sections
      await trx.deleteFrom("courseSections").where("courseId", "=", courseId).execute();
      
      // Delete course
      await trx.deleteFrom("courses").where("id", "=", courseId).execute();
    });

    console.log(`[Course Delete] Successfully deleted course ${courseId} and ${fileIdsToDelete.length} associated files from database`);

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("Error deleting course:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to delete course", details: errorMessage }),
      { status: 500 }
    );
  }
}