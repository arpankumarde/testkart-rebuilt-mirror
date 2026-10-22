import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./approve-all_POST.schema";
import {
  clearOpenReviews,
  ContentGoneError,
  loadContentState,
  publishApprovedContent,
} from "../../../helpers/contentReviewQueue";
import { getContentTitle, sendReviewEmail } from "../../../helpers/contentReviewEmail";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    schema.parse(json); // Validate empty body

    const now = new Date();

    // Only pending: reviews moved to Senior approval wait for a person to decide them
    const pendingReviews = await db
      .selectFrom("contentReviews")
      .selectAll()
      .where("status", "=", "pending")
      .execute();

    if (pendingReviews.length === 0) {
      const output: OutputType = {
        success: true,
        approvedCount: 0,
        message: "No pending reviews found.",
      };
      return new Response(superjson.stringify(output));
    }

    // One transaction per item, so an item that can no longer go live (a
    // passed live test schedule, a trashed series) stays pending on its own. A
    // review whose item was deleted is removed from the queue without an email.
    const approved: typeof pendingReviews = [];
    const publicRequestIds = new Set<number>();
    let removedCount = 0;
    for (const review of pendingReviews) {
      try {
        const state = await loadContentState(db, review.contentType, review.contentId);
        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable("contentReviews")
            .set({
              status: "approved",
              reviewedBy: admin.id,
              reviewedAt: now,
              updatedAt: now,
            })
            .where("id", "=", review.id)
            .where("status", "=", "pending")
            .execute();
          await publishApprovedContent(trx, review.contentType, review.contentId, now);
        });
        approved.push(review);
        if (state?.live && state.visibility === "unlisted") publicRequestIds.add(review.id);
      } catch (err) {
        if (err instanceof ContentGoneError) {
          await clearOpenReviews(db, review.contentType, review.contentId);
          removedCount++;
          continue;
        }
        console.warn(`Review ${review.id} left pending:`, err);
      }
    }
    const skippedCount = pendingReviews.length - approved.length - removedCount;

    // Awaited: Floot drops a send still running after the response goes out.
    await Promise.allSettled(
      approved.map(async (review) => {
        try {
          const teacher = await db
            .selectFrom("users")
            .select(["id", "displayName", "email"])
            .where("id", "=", review.teacherId)
            .executeTakeFirst();

          if (teacher?.email) {
            const contentTitle = await getContentTitle(review.contentType, review.contentId);
            await sendReviewEmail(
              teacher.email,
              teacher.displayName,
              review.contentType,
              review.contentId,
              contentTitle,
              "approve",
              null,
              publicRequestIds.has(review.id)
            );
          }
        } catch (err) {
          console.error(`Failed to process approval email for review ${review.id}:`, err);
        }
      })
    );

    const removedNote =
      removedCount > 0
        ? ` ${removedCount} removed from the queue because the teacher deleted them (no email sent).`
        : "";
    const output: OutputType = {
      success: true,
      approvedCount: approved.length,
      message:
        (skippedCount > 0
          ? `Approved and published ${approved.length} item(s). ${skippedCount} could not go live and are still pending - open them to see why.`
          : `Successfully approved and published ${approved.length} item(s).`) + removedNote,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error processing bulk content approval:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      error instanceof Error && error.name === "NotAuthenticatedError"
        ? 401
        : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
