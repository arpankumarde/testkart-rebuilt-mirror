import { db } from "./db";
import { R2_PUBLIC_URL } from "./_publicConfigs";
import { isMuxDrmConfigured, isMuxRequestError, muxRequest } from "./muxRequest";

/**
 * DRM lessons on Mux (replacing Gumlet). The video is uploaded to R2 as usual, then Mux
 * pulls it from its public CDN URL and packages it with DRM (Widevine, PlayReady,
 * FairPlay). Only lessons of teachers with users.drm_enabled are pushed.
 *
 * Dormant until MUX_TOKEN_ID, MUX_TOKEN_SECRET and MUX_DRM_CONFIGURATION_ID are set.
 *
 * Mux has no folders, so each asset carries its lesson, course and teacher in meta and
 * passthrough. The webhook (webhooks/mux) moves mux_status to ready or failed; the
 * playback endpoint can also ask Mux directly through refreshMuxAssetState.
 *
 * One library video can back several lessons of the same teacher. The first lesson
 * pushes it, later lessons reuse that asset, and an asset is only deleted from Mux once
 * no lesson points at it.
 */

type MuxAsset = {
  id: string;
  status: "preparing" | "ready" | "errored";
  playback_ids?: Array<{ id: string; policy: string }>;
  errors?: { type?: string; messages?: string[] };
};

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

export function describeMuxAssetErrors(errors: MuxAsset["errors"]): string {
  const text = [errors?.type, ...(errors?.messages ?? [])].filter(Boolean).join(": ");
  return (text || "Mux processing errored").slice(0, 500);
}

async function createDrmAsset(input: {
  sourceUrl: string;
  title: string;
  lessonId: number;
  courseId: number;
  teacherId: number;
}): Promise<{ assetId: string; playbackId: string }> {
  const asset = await muxRequest<MuxAsset>("POST", "/video/v1/assets", {
    inputs: [{ url: input.sourceUrl }],
    advanced_playback_policies: [{ policy: "drm", drm_configuration_id: process.env.MUX_DRM_CONFIGURATION_ID }],
    video_quality: "plus",
    max_resolution_tier: "1080p",
    passthrough: `lesson:${input.lessonId};course:${input.courseId};teacher:${input.teacherId}`,
    meta: {
      title: input.title.slice(0, 500),
      creator_id: `teacher-${input.teacherId}`,
      external_id: `lesson-${input.lessonId}`,
    },
  });
  const playbackId = asset.playback_ids?.find((p) => p.policy === "drm")?.id;
  if (!asset.id || !playbackId) throw new Error("Mux created the asset without a DRM playback id.");
  return { assetId: asset.id, playbackId };
}

async function deleteMuxAsset(assetId: string): Promise<void> {
  try {
    await muxRequest("DELETE", `/video/v1/assets/${assetId}`);
    console.log(`[mux] Deleted Mux asset ${assetId}`);
  } catch (error) {
    if (isMuxRequestError(error) && error.status === 404) return;
    console.error(`[mux] Could not delete Mux asset ${assetId}:`, error);
  }
}

/**
 * Reads an asset's state from Mux and stores "ready" or "failed" on every lesson using it.
 * For when the webhook has not arrived yet. Never throws; an API failure reads as processing.
 */
export async function refreshMuxAssetState(assetId: string): Promise<"ready" | "processing" | "failed"> {
  try {
    const asset = await muxRequest<MuxAsset>("GET", `/video/v1/assets/${assetId}`);
    if (asset.status === "ready") {
      await db.updateTable("courseLessons").set({ muxStatus: "ready", muxError: null }).where("muxAssetId", "=", assetId).execute();
      return "ready";
    }
    if (asset.status === "errored") {
      await db
        .updateTable("courseLessons")
        .set({ muxStatus: "failed", muxError: describeMuxAssetErrors(asset.errors) })
        .where("muxAssetId", "=", assetId)
        .execute();
      return "failed";
    }
    return "processing";
  } catch (error) {
    console.error(`[mux] Could not read Mux asset ${assetId}:`, error);
    return "processing";
  }
}

/**
 * Call after lessons are deleted, with the Mux asset ids they held. Deletes each asset
 * from Mux unless a remaining lesson still uses it. Never throws, so a Mux outage cannot
 * fail a delete; a failure is only logged.
 */
export async function releaseMuxAssets(assetIds: Array<string | null | undefined>): Promise<void> {
  const unique = [...new Set(assetIds.filter((id): id is string => !!id))];
  if (unique.length === 0) return;

  try {
    const stillUsed = await db.selectFrom("courseLessons").select("muxAssetId").where("muxAssetId", "in", unique).execute();
    const usedIds = new Set(stillUsed.map((row) => row.muxAssetId));
    for (const assetId of unique) {
      if (!usedIds.has(assetId)) await deleteMuxAsset(assetId);
    }
  } catch (error) {
    console.error("[releaseMuxAssets] Cleanup failed:", error);
  }
}

/**
 * Call after a lesson is created or updated. Reconciles the lesson with Mux: drops an
 * asset that failed or no longer matches the lesson's video, and pushes the video when
 * the course's teacher has DRM on. Safe to call repeatedly, and never throws, so a Mux
 * outage cannot fail a lesson save. A failed push is recorded and retried by the next save.
 */
export async function syncLessonVideoToMux(lessonId: number): Promise<void> {
  if (!isMuxDrmConfigured()) return;

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
        "courseLessons.muxAssetId",
        "courseLessons.muxSourceUrl",
        "courseLessons.muxStatus",
        "courses.id as courseId",
        "courses.title as courseTitle",
        "users.id as teacherId",
        "users.drmEnabled",
      ])
      .where("courseLessons.id", "=", lessonId)
      .executeTakeFirst();

    if (!lesson) return;

    const isVideo = lesson.contentType === "video" && !!lesson.contentUrl;

    if (lesson.muxAssetId && (!isVideo || lesson.muxSourceUrl !== lesson.contentUrl || lesson.muxStatus === "failed")) {
      const sharedWith = await db
        .selectFrom("courseLessons")
        .select("id")
        .where("muxAssetId", "=", lesson.muxAssetId)
        .where("id", "!=", lessonId)
        .executeTakeFirst();
      if (!sharedWith) await deleteMuxAsset(lesson.muxAssetId);
      await db
        .updateTable("courseLessons")
        .set({ muxAssetId: null, muxPlaybackId: null, muxSourceUrl: null, muxStatus: null, muxError: null })
        .where("id", "=", lessonId)
        .execute();
      lesson.muxAssetId = null;
      lesson.muxStatus = null;
    }

    if (!lesson.drmEnabled || !isVideo || !lesson.contentUrl || !isR2Url(lesson.contentUrl)) return;
    if (lesson.muxAssetId && lesson.muxStatus !== "failed") return;

    try {
      const reusable = await db
        .selectFrom("courseLessons")
        .innerJoin("courseSections", "courseSections.id", "courseLessons.sectionId")
        .innerJoin("courses", "courses.id", "courseSections.courseId")
        .select(["courseLessons.muxAssetId", "courseLessons.muxPlaybackId", "courseLessons.muxStatus"])
        .where("courses.teacherId", "=", lesson.teacherId)
        .where("courseLessons.id", "!=", lessonId)
        .where("courseLessons.muxSourceUrl", "=", lesson.contentUrl)
        .where("courseLessons.muxAssetId", "is not", null)
        .where("courseLessons.muxStatus", "in", ["submitted", "ready"])
        .executeTakeFirst();

      if (reusable?.muxAssetId) {
        await db
          .updateTable("courseLessons")
          .set({
            muxAssetId: reusable.muxAssetId,
            muxPlaybackId: reusable.muxPlaybackId,
            muxSourceUrl: lesson.contentUrl,
            muxStatus: reusable.muxStatus,
            muxError: null,
          })
          .where("id", "=", lessonId)
          .execute();
        console.log(`[syncLessonVideoToMux] Lesson ${lessonId} reuses Mux asset ${reusable.muxAssetId}`);
        return;
      }

      const { assetId, playbackId } = await createDrmAsset({
        sourceUrl: lesson.contentUrl,
        title: `${lesson.courseTitle} - ${lesson.title}`,
        lessonId: lesson.id,
        courseId: lesson.courseId,
        teacherId: lesson.teacherId,
      });

      await db
        .updateTable("courseLessons")
        .set({
          muxAssetId: assetId,
          muxPlaybackId: playbackId,
          muxSourceUrl: lesson.contentUrl,
          muxStatus: "submitted",
          muxError: null,
        })
        .where("id", "=", lessonId)
        .execute();
      console.log(`[syncLessonVideoToMux] Lesson ${lessonId} pushed to Mux as asset ${assetId}`);
    } catch (error) {
      console.error(`[syncLessonVideoToMux] Push failed for lesson ${lessonId}:`, error);
      await db
        .updateTable("courseLessons")
        .set({ muxStatus: "failed", muxError: errorMessage(error) })
        .where("id", "=", lessonId)
        .execute();
    }
  } catch (error) {
    console.error(`[syncLessonVideoToMux] Sync failed for lesson ${lessonId}:`, error);
  }
}
