import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { deleteOwnedR2Files } from "../../../helpers/r2FileOwnership";
import { releaseGumletAssets } from "../../../helpers/syncLessonVideoToGumlet";

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

    // Fetch the lessons' files and DRM copies before deletion for cleanup
    const lessons = await db
      .selectFrom("courseLessons")
      .select(["contentFileId", "gumletAssetId"])
      .where("sectionId", "=", sectionId)
      .execute();

    const contentFileIds = lessons
      .map((l) => l.contentFileId)
      .filter((id): id is string => id !== null);

    // Use a transaction to delete the section and its lessons
    await db.transaction().execute(async (trx) => {
        // Delete all lessons within this section
        await trx.deleteFrom("courseLessons").where("sectionId", "=", sectionId).execute();
        // Delete the section itself
        await trx.deleteFrom("courseSections").where("id", "=", sectionId).execute();
    });

    // With the rows gone, remove the files this teacher uploaded that nothing else uses
    const { deleted } = await deleteOwnedR2Files(effectiveTeacherId, contentFileIds);
    console.log(`[Section Delete] Cleaned up ${deleted.length}/${contentFileIds.length} R2 files for section ${sectionId}`);
    await releaseGumletAssets(lessons.map((l) => l.gumletAssetId));

    return new Response(superjson.stringify({ success: true } satisfies OutputType));

  } catch (error) {
    console.error("Error deleting course section:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: "Failed to delete section", details: errorMessage }), { status: 500 });
  }
}