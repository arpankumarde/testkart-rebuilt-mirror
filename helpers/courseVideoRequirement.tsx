import type { Kysely, Transaction } from "kysely";
import type { DB } from "./schema";

/**
 * A course needs at least one video lesson with an uploaded file before it is
 * published or sent for review. The editor checklist runs the same rule
 * (helpers/courseDraft isVideoLessonWithFile).
 */
export async function courseHasVideoLesson(
  executor: Kysely<DB> | Transaction<DB>,
  courseId: number
): Promise<boolean> {
  const row = await executor
    .selectFrom("courseLessons")
    .innerJoin("courseSections", "courseSections.id", "courseLessons.sectionId")
    .select("courseLessons.id")
    .where("courseSections.courseId", "=", courseId)
    .where("courseLessons.contentType", "=", "video")
    .where("courseLessons.contentUrl", "is not", null)
    .where("courseLessons.contentUrl", "<>", "")
    .limit(1)
    .executeTakeFirst();
  return Boolean(row);
}
