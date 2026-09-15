import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { deleteFromR2 } from "../../../helpers/r2Client";

async function checkSectionOwnership(sectionId: number, teacherId: number, userRole: string): Promise<boolean> {
    if (userRole === 'admin') return true;
    const section = await db.selectFrom("courseSections")
        .innerJoin("courses", "courses.id", "courseSections.courseId")
        .select("courses.teacherId")
        .where("courseSections.id", "=", sectionId)
        .executeTakeFirst();
    return !!section && section.teacherId === teacherId;
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const { sectionId } = schema.parse(json);

    const isOwner = await checkSectionOwnership(sectionId, effectiveTeacherId, user.role);
    if (!isOwner) {
        return new Response(superjson.stringify({ error: "You do not own this course section" }), { status: 403 });
    }

    // Fetch all lessons with contentFileId before deletion for R2 cleanup
    const lessons = await db
      .selectFrom("courseLessons")
      .select("contentFileId")
      .where("sectionId", "=", sectionId)
      .where("contentFileId", "is not", null)
      .execute();

    const contentFileIds = lessons
      .map((l) => l.contentFileId)
      .filter((id): id is string => id !== null);

    // Clean up R2 files before transaction
    let deletedCount = 0;
    for (const fileId of contentFileIds) {
      try {
        await deleteFromR2(fileId);
        deletedCount++;
      } catch (error) {
        console.error(`[Section Delete] Failed to delete R2 file ${fileId}:`, error);
        // Continue with other deletions
      }
    }
    console.log(`[Section Delete] Cleaned up ${deletedCount}/${contentFileIds.length} R2 files for section ${sectionId}`);

    // Use a transaction to delete the section and its lessons
    await db.transaction().execute(async (trx) => {
        // Delete all lessons within this section
        await trx.deleteFrom("courseLessons").where("sectionId", "=", sectionId).execute();
        // Delete the section itself
        await trx.deleteFrom("courseSections").where("id", "=", sectionId).execute();
    });

    return new Response(superjson.stringify({ success: true } satisfies OutputType));

  } catch (error) {
    console.error("Error deleting course section:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to delete section", details: errorMessage }), { status: 500 });
  }
}