import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { isUploadedIntroVideoUrl, toLiveTeachingStatus } from "../../../helpers/liveTeachingRules";
import { schema, OutputType } from "./video_POST.schema";

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

/*
 * Saves the intro video. Before applying, or after a rejection or revocation, it changes at once.
 * While an application is in review the new video replaces the one in that application. An
 * approved teacher's new video goes to the admin queue as a video change (kind 'video'); the
 * current video stays on the profile until an admin approves the new one.
 */
export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" || user.teacherRole === "manager") {
      return fail("Only the account owner can change the intro video.", 403);
    }

    const input = schema.parse(superjson.parse(await request.text()));
    if (input.introVideoUrl !== null && !isUploadedIntroVideoUrl(input.introVideoUrl)) {
      return fail("Upload your intro video here. Links to other sites are not accepted.");
    }
    const fileId = input.introVideoUrl ? input.introVideoFileId ?? null : null;

    const row = await db
      .selectFrom("teachers")
      .select(["liveTeachingStatus", "introVideoUrl"])
      .where("id", "=", effectiveTeacherId)
      .executeTakeFirst();
    const status = toLiveTeachingStatus(row?.liveTeachingStatus);

    if ((status === "pending" || status === "approved") && input.introVideoUrl === null) {
      return fail("Upload a new video to replace this one. A live teacher always needs an intro video.");
    }

    if (status === "approved") {
      if (input.introVideoUrl === row?.introVideoUrl) return fail("This is already your intro video.");
      const now = new Date();
      await db.transaction().execute(async (trx) => {
        const updated = await trx
          .updateTable("liveTeachingApplications")
          .set({ introVideoUrl: input.introVideoUrl!, introVideoFileId: fileId, createdAt: now, updatedAt: now })
          .where("teacherId", "=", effectiveTeacherId)
          .where("kind", "=", "video")
          .where("status", "=", "pending")
          .executeTakeFirst();
        if (Number(updated.numUpdatedRows) === 0) {
          await trx
            .insertInto("liveTeachingApplications")
            .values({
              teacherId: effectiveTeacherId,
              kind: "video",
              status: "pending",
              introVideoUrl: input.introVideoUrl!,
              introVideoFileId: fileId,
            })
            .execute();
        }
      });
      const output: OutputType = { success: true, inReview: true };
      return new Response(superjson.stringify(output));
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("teachers")
        .set({ introVideoUrl: input.introVideoUrl, introVideoFileId: fileId })
        .where("id", "=", effectiveTeacherId)
        .execute();
      if (status === "pending") {
        await trx
          .updateTable("liveTeachingApplications")
          .set({ introVideoUrl: input.introVideoUrl!, introVideoFileId: fileId, updatedAt: new Date() })
          .where("teacherId", "=", effectiveTeacherId)
          .where("kind", "=", "application")
          .where("status", "=", "pending")
          .execute();
      }
    });

    const output: OutputType = { success: true, inReview: false };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error saving live teaching intro video:", error);
    return fail(error instanceof Error ? error.message : "An unknown error occurred");
  }
}
