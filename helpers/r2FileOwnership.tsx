import { sql } from "kysely";
import { db } from "./db";
import { deleteFromR2 } from "./r2Client";

/**
 * Ownership for user-uploaded R2 objects. upload/presign and
 * upload/multipart/initiate record who each key was issued to (the teacher
 * account for team managers, null for admin panel uploads). Only that
 * uploader may resume or complete a multipart upload on the key, and a user
 * may only delete keys recorded as theirs that no stored content still points
 * at. Objects uploaded before recording started have no row, so they are
 * never deleted on a user's request.
 */

export async function recordUploadedFile(key: string, ownerUserId: number | null): Promise<void> {
  await db
    .insertInto("uploadedFiles")
    .values({ key, ownerUserId })
    .onConflict((oc) => oc.column("key").doNothing())
    .execute();
}

/** True when the key was issued to this uploader (null for admin panel uploads). */
export async function isUploadIssuedTo(key: string, ownerUserId: number | null): Promise<boolean> {
  const record = await db
    .selectFrom("uploadedFiles")
    .select("ownerUserId")
    .where("key", "=", key)
    .executeTakeFirst();
  return !!record && record.ownerUserId === ownerUserId;
}

// Every column that stores an R2 key or its public URL.
const REFERENCE_COLUMNS: Record<string, string[]> = {
  admins: ["avatar_file_id", "avatar_url"],
  career_applications: ["resume_file_id", "resume_url"],
  certificates: ["pdf_url"],
  course_bundles: ["intro_video_file_id", "intro_video_url", "thumbnail_file_id", "thumbnail_url"],
  course_lessons: ["content_file_id", "content_url"],
  course_media: ["file_id", "media_url"],
  courses: [
    "intro_video_file_id",
    "intro_video_url",
    "thumbnail_file_id",
    "thumbnail_image_file_id",
    "thumbnail_image_url",
    "thumbnail_url",
  ],
  digital_product_files: ["file_id", "file_url"],
  digital_products: ["pdf_file_id", "pdf_url", "thumbnail_file_id", "thumbnail_url"],
  live_tests: ["intro_video_file_id", "intro_video_url", "thumbnail_file_id", "thumbnail_url"],
  mock_tests: ["intro_video_file_id", "intro_video_url", "thumbnail_file_id", "thumbnail_url"],
  news_coverage: ["image_file_id", "image_url"],
  teacher_assets: ["key", "url"],
  users: ["avatar_file_id", "avatar_url"],
};

/** True when any stored row holds the key itself or a URL ending in "/<key>". */
export async function isR2KeyReferenced(key: string): Promise<boolean> {
  const suffix = `/${key}`;
  const checks = Object.entries(REFERENCE_COLUMNS).map(([table, columns]) => {
    const conditions = sql.join(
      columns.map(
        (column) => sql`${sql.ref(column)} = ${key} OR right(${sql.ref(column)}, ${suffix.length}) = ${suffix}`
      ),
      sql` OR `
    );
    return sql`EXISTS (SELECT 1 FROM ${sql.table(table)} WHERE ${conditions})`;
  });

  const result = await sql<{ referenced: boolean }>`SELECT (${sql.join(checks, sql` OR `)}) AS referenced`.execute(db);
  return Boolean(result.rows[0]?.referenced);
}

export type OwnedDeleteOutcome = "deleted" | "not_owned" | "in_use";

export async function deleteOwnedR2File(ownerUserId: number, key: string): Promise<OwnedDeleteOutcome> {
  const record = await db
    .selectFrom("uploadedFiles")
    .select("ownerUserId")
    .where("key", "=", key)
    .executeTakeFirst();

  if (!record || record.ownerUserId !== ownerUserId) return "not_owned";
  if (await isR2KeyReferenced(key)) return "in_use";

  await deleteFromR2(key);
  await db.deleteFrom("uploadedFiles").where("key", "=", key).execute();
  return "deleted";
}

/**
 * Best-effort cleanup for content deletes: removes the keys the owner uploaded
 * that nothing else uses and keeps the rest. Call it after the content rows are
 * deleted, so they no longer count as references. Never throws.
 */
export async function deleteOwnedR2Files(
  ownerUserId: number,
  keys: Array<string | null | undefined>
): Promise<{ deleted: string[]; kept: string[] }> {
  const deleted: string[] = [];
  const kept: string[] = [];

  for (const key of new Set(keys.filter((k): k is string => !!k))) {
    try {
      const outcome = await deleteOwnedR2File(ownerUserId, key);
      (outcome === "deleted" ? deleted : kept).push(key);
    } catch (error) {
      console.error(`[deleteOwnedR2Files] Failed to delete R2 file ${key}:`, error);
      kept.push(key);
    }
  }

  return { deleted, kept };
}
