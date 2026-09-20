import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { deleteOwnedR2Files } from "../../../helpers/r2FileOwnership";
import { releaseGumletAssets } from "../../../helpers/syncLessonVideoToGumlet";

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

    // Collect the R2 keys of the course's files
    const fileIdsToDelete: string[] = [];

    // Get course thumbnail fileIds
    if (course.thumbnailFileId) {
      fileIdsToDelete.push(course.thumbnailFileId);
    }
    if (course.thumbnailImageFileId) {
      fileIdsToDelete.push(course.thumbnailImageFileId);
    }

    // Get all lesson files and DRM copies
    const sectionIds = await db
      .selectFrom("courseSections")
      .select("id")
      .where("courseId", "=", courseId)
      .execute();
    
    const sectionIdList = sectionIds.map(s => s.id);
    const gumletAssetIds: Array<string | null> = [];

    if (sectionIdList.length > 0) {
      const lessons = await db
        .selectFrom("courseLessons")
        .select(["contentFileId", "gumletAssetId"])
        .where("sectionId", "in", sectionIdList)
        .execute();
      
      lessons.forEach(lesson => {
        if (lesson.contentFileId) {
          fileIdsToDelete.push(lesson.contentFileId);
        }
        gumletAssetIds.push(lesson.gumletAssetId);
      });
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

    // With the rows gone, remove the files the course's teacher uploaded that nothing else uses
    const { deleted } = await deleteOwnedR2Files(course.teacherId, fileIdsToDelete);
    await releaseGumletAssets(gumletAssetIds);

    console.log(`[Course Delete] Deleted course ${courseId} and ${deleted.length}/${fileIdsToDelete.length} associated R2 files`);

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