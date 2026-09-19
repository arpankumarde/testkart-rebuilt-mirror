import { db } from "./db";
import { extractR2Key } from "./extractR2Key";
import { R2_PUBLIC_URL } from "./_publicConfigs";
import { gumletRequest, type GumletRequestError } from "./gumletRequest";

/**
 * DRM lessons: the video is uploaded to R2 as usual, then pushed to the
 * "Primary R2" Gumlet workspace with DRM enabled. Only lessons of teachers
 * with users.drm_enabled are pushed; everything else stays on R2 untouched.
 *
 * Gumlet folders mirror the R2 layout (course/<courseId>/...) under the owning
 * teacher: teacher-<teacherId>/course-<courseId>. Each asset is titled and
 * tagged with the lesson so it can be traced back from the Gumlet dashboard.
 *
 * Gumlet fetches the file from its public CDN URL. A presigned R2 URL is signed
 * for GET only, and Gumlet rejects it as an invalid input URL.
 */

const GUMLET_WORKSPACE_NAME = "Primary R2";
const WORKSPACE_PAGE_SIZE = 50;

function isGumletError(error: unknown): error is GumletRequestError {
  return error instanceof Error && error.name === "GumletRequestError";
}

async function findWorkspaceId(): Promise<string> {
  for (let offset = 0; ; offset += WORKSPACE_PAGE_SIZE) {
    const page = await gumletRequest<{ all_sources?: Array<{ id: string; name: string }> }>(
      "GET",
      `/video/workspaces?offset=${offset}&size=${WORKSPACE_PAGE_SIZE}`
    );
    const workspaces = page.all_sources ?? [];
    const match = workspaces.find((w) => w.name.trim().toLowerCase() === GUMLET_WORKSPACE_NAME.toLowerCase());
    if (match) return match.id;
    if (workspaces.length < WORKSPACE_PAGE_SIZE) break;
  }
  throw new Error(`Gumlet workspace "${GUMLET_WORKSPACE_NAME}" was not found.`);
}

async function ensureFolders(workspaceId: string, segments: string[]): Promise<{ folderId: string; cachePaths: string[] }> {
  let parentId: string | null = null;
  const cachePaths: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const cachePath = `${workspaceId}/${segments.slice(0, i + 1).join("/")}`;
    cachePaths.push(cachePath);

    const cached = await db.selectFrom("gumletFolders").select("folderId").where("path", "=", cachePath).executeTakeFirst();
    if (cached) {
      parentId = cached.folderId;
      continue;
    }

    const folderId = await createOrFindFolder(workspaceId, segments[i], parentId);
    await db
      .insertInto("gumletFolders")
      .values({ path: cachePath, folderId })
      .onConflict((oc) => oc.column("path").doNothing())
      .execute();
    const stored = await db.selectFrom("gumletFolders").select("folderId").where("path", "=", cachePath).executeTakeFirstOrThrow();
    parentId = stored.folderId;
  }

  return { folderId: parentId as string, cachePaths };
}

async function createOrFindFolder(workspaceId: string, name: string, parentId: string | null): Promise<string> {
  try {
    const created = await gumletRequest<{ id: string }>("POST", `/video/workspaces/${workspaceId}/folders`, {
      name,
      parent_id: parentId,
    });
    return created.id;
  } catch (error) {
    if (!isGumletError(error) || error.code !== "folder_name_exists") throw error;
    const query = parentId ? `?parent_id=${encodeURIComponent(parentId)}` : "";
    const folders = await gumletRequest<Array<{ id: string; name: string; parent_id?: string | null }>>(
      "GET",
      `/video/workspaces/${workspaceId}/folders${query}`
    );
    const existing = folders.find((f) => f.name === name && (f.parent_id ?? null) === parentId);
    if (!existing) throw error;
    return existing.id;
  }
}

function isFolderError(error: unknown): boolean {
  return isGumletError(error) && error.status >= 400 && error.status < 500 && /folder/i.test(error.message);
}

async function createDrmAsset(input: {
  workspaceId: string;
  folderSegments: string[];
  sourceUrl: string;
  title: string;
  metadata: Record<string, string | number>;
}): Promise<string> {
  const attempt = async () => {
    const { folderId, cachePaths } = await ensureFolders(input.workspaceId, input.folderSegments);
    try {
      const asset = await gumletRequest<{ asset_id: string }>("POST", "/video/assets", {
        collection_id: input.workspaceId,
        input: input.sourceUrl,
        format: "ABR",
        enable_drm: true,
        folder: folderId,
        title: input.title,
        metadata: input.metadata,
      });
      return asset.asset_id;
    } catch (error) {
      if (isFolderError(error)) {
        // A folder removed from the Gumlet dashboard leaves a stale cached id
        await db.deleteFrom("gumletFolders").where("path", "in", cachePaths).execute();
      }
      throw error;
    }
  };

  try {
    return await attempt();
  } catch (error) {
    if (isFolderError(error)) return attempt();
    throw error;
  }
}

function isR2Url(url: string): boolean {
  try {
    return new URL(url).host === R2_PUBLIC_URL;
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message.replace(/https?:\/\/\S+/g, "[url]").slice(0, 500);
}

/**
 * Call after a lesson is created or updated. Reconciles the lesson with Gumlet:
 * drops an asset that failed or no longer matches the lesson's video, and pushes the video
 * when the course's teacher has DRM on. Safe to call repeatedly, and never
 * throws, so a Gumlet outage cannot fail a lesson save. A failed push is
 * recorded on the lesson and retried by the next save.
 */
export async function syncLessonVideoToGumlet(lessonId: number): Promise<void> {
  try {
    const lesson = await db
      .selectFrom("courseLessons")
      .innerJoin("courseSections", "courseSections.id", "courseLessons.sectionId")
      .innerJoin("courses", "courses.id", "courseSections.courseId")
      .innerJoin("users", "users.id", "courses.teacherId")
      .select([
        "courseLessons.id",
        "courseLessons.title",
        "courseLessons.contentType",
        "courseLessons.contentUrl",
        "courseLessons.gumletAssetId",
        "courseLessons.gumletSourceUrl",
        "courseLessons.gumletStatus",
        "courses.id as courseId",
        "courses.title as courseTitle",
        "users.id as teacherId",
        "users.drmEnabled",
      ])
      .where("courseLessons.id", "=", lessonId)
      .executeTakeFirst();

    if (!lesson) return;

    const isVideo = lesson.contentType === "video" && !!lesson.contentUrl;

    if (
      lesson.gumletAssetId &&
      (!isVideo || lesson.gumletSourceUrl !== lesson.contentUrl || lesson.gumletStatus === "failed")
    ) {
      try {
        await gumletRequest("DELETE", `/video/assets/${lesson.gumletAssetId}`);
      } catch (error) {
        console.error(`[syncLessonVideoToGumlet] Could not delete replaced asset ${lesson.gumletAssetId}:`, error);
      }
      await db
        .updateTable("courseLessons")
        .set({ gumletAssetId: null, gumletSourceUrl: null, gumletStatus: null, gumletError: null })
        .where("id", "=", lessonId)
        .execute();
      lesson.gumletAssetId = null;
      lesson.gumletStatus = null;
    }

    if (!lesson.drmEnabled || !isVideo || !lesson.contentUrl || !isR2Url(lesson.contentUrl)) return;
    if (lesson.gumletAssetId && lesson.gumletStatus !== "failed") return;

    try {
      const workspaceId = await findWorkspaceId();
      const r2Key = extractR2Key(lesson.contentUrl);

      const assetId = await createDrmAsset({
        workspaceId,
        folderSegments: [`teacher-${lesson.teacherId}`, `course-${lesson.courseId}`],
        sourceUrl: lesson.contentUrl,
        title: `${lesson.courseTitle} - ${lesson.title}`.slice(0, 200),
        metadata: {
          lesson_id: lesson.id,
          course_id: lesson.courseId,
          teacher_id: lesson.teacherId,
          r2_key: r2Key,
        },
      });

      await db
        .updateTable("courseLessons")
        .set({
          gumletAssetId: assetId,
          gumletSourceUrl: lesson.contentUrl,
          gumletStatus: "submitted",
          gumletError: null,
        })
        .where("id", "=", lessonId)
        .execute();
      console.log(`[syncLessonVideoToGumlet] Lesson ${lessonId} pushed to Gumlet as asset ${assetId}`);
    } catch (error) {
      console.error(`[syncLessonVideoToGumlet] Push failed for lesson ${lessonId}:`, error);
      await db
        .updateTable("courseLessons")
        .set({ gumletStatus: "failed", gumletError: errorMessage(error) })
        .where("id", "=", lessonId)
        .execute();
    }
  } catch (error) {
    console.error(`[syncLessonVideoToGumlet] Sync failed for lesson ${lessonId}:`, error);
  }
}
