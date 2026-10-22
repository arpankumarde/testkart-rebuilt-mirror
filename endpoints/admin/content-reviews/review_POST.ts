import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./review_POST.schema";
import {
  clearOpenReviews,
  ContentGoneError,
  contentGoneMessage,
  loadContentState,
  publishApprovedContent,
} from "../../../helpers/contentReviewQueue";
import { getContentTitle, sendReviewEmail } from "../../../helpers/contentReviewEmail";
import { isOpenReview } from "../../../helpers/contentReviewStatus";
import type { ContentType } from "../../../helpers/schema";
import { creditClaim, withdrawClaimsForReviews, type CampaignClaim } from "../../../helpers/teacherCampaign";
import { sendCampaignDecisionEmail } from "../../../helpers/teacherCampaignEmail";
import { formatRupees } from "../../../helpers/teacherCampaignRules";

/* The item was deleted after it was submitted: close its review without emailing the teacher. */
const goneResponse = async (contentType: ContentType, contentId: number) => {
  await clearOpenReviews(db, contentType, contentId);
  return new Response(superjson.stringify({ error: contentGoneMessage(contentType) }), { status: 410 });
};

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Fetch the review record
    const review = await db
      .selectFrom("contentReviews")
      .selectAll()
      .where("id", "=", input.reviewId)
      .executeTakeFirst();

    if (!review) {
      return new Response(
        superjson.stringify({
          error: "This item is no longer waiting for review. The teacher took it back or deleted it.",
        }),
        { status: 404 }
      );
    }

    if (!isOpenReview(review.status)) {
      return new Response(
        superjson.stringify({
          error: `Review has already been ${review.status}. Only reviews still waiting for a decision can be actioned.`,
        }),
        { status: 400 }
      );
    }

    if (!(await loadContentState(db, review.contentType, review.contentId))) {
      return goneResponse(review.contentType, review.contentId);
    }

    if (input.action === "send_to_senior" || input.action === "back_to_pending") {
      const toSenior = input.action === "send_to_senior";
      const from = toSenior ? "pending" : "senior_review";
      const updated = await db
        .updateTable("contentReviews")
        .set({ status: toSenior ? "senior_review" : "pending", updatedAt: new Date() })
        .where("id", "=", input.reviewId)
        .where("status", "=", from)
        .executeTakeFirst();
      if (Number(updated.numUpdatedRows) === 0) {
        return new Response(
          superjson.stringify({
            error: toSenior
              ? "This review is already waiting for senior approval."
              : "This review is not waiting for senior approval.",
          }),
          { status: 400 }
        );
      }
      const output: OutputType = {
        success: true,
        message: toSenior
          ? "It moved to Senior approval. Any admin can approve or reject it. The teacher still sees it as in review."
          : "It is back in the Pending queue.",
      };
      return new Response(superjson.stringify(output));
    }

    // Fetch teacher info for email
    const teacher = await db
      .selectFrom("users")
      .select(["id", "displayName", "email"])
      .where("id", "=", review.teacherId)
      .executeTakeFirst();

    const now = new Date();

    if (input.action === "approve") {
      try {
        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable("contentReviews")
            .set({
              status: "approved",
              reviewedBy: admin.id,
              reviewedAt: now,
              adminNotes: input.adminNotes ?? null,
              updatedAt: now,
            })
            .where("id", "=", input.reviewId)
            .execute();
          await publishApprovedContent(trx, review.contentType, review.contentId, now);
        });
      } catch (publishError) {
        if (publishError instanceof ContentGoneError) {
          return goneResponse(review.contentType, review.contentId);
        }
        const reason = publishError instanceof Error ? publishError.message : "It could not be published.";
        return new Response(
          superjson.stringify({ error: `Not approved: ${reason}` }),
          { status: 400 }
        );
      }

      // Awaited: Floot drops a send still running after the response goes out.
      if (teacher?.email) {
        const contentTitle = await getContentTitle(review.contentType, review.contentId);
        await sendReviewEmail(
          teacher.email,
          teacher.displayName,
          review.contentType,
          review.contentId,
          contentTitle,
          "approve",
          input.adminNotes
        );
      }

      // Crediting is a separate call on quality, so a failure here leaves the approval in place.
      let bonusNote = "";
      if (input.creditBonus) {
        const claim = await db
          .selectFrom("teacherCampaignClaims")
          .innerJoin("teacherCampaigns", "teacherCampaigns.id", "teacherCampaignClaims.campaignId")
          .select(["teacherCampaignClaims.id", "teacherCampaigns.title"])
          .where("teacherCampaignClaims.contentReviewId", "=", input.reviewId)
          .where("teacherCampaignClaims.status", "=", "claimed")
          .executeTakeFirst();
        if (!claim) {
          bonusNote = " No bonus claim was waiting on this submission.";
        } else {
          try {
            const credited: CampaignClaim = await db
              .transaction()
              .execute((trx) => creditClaim(trx, claim.id, admin.id, new Date()));
            await sendCampaignDecisionEmail(credited, "credited");
            bonusNote = ` ${formatRupees(Number(credited.amount))} ${claim.title} credited.`;
          } catch (creditError) {
            const reason = creditError instanceof Error ? creditError.message : "it could not be credited.";
            bonusNote = ` The ${claim.title} was not credited: ${reason}`;
          }
        }
      }

      const output: OutputType = {
        success: true,
        message: `Content approved and published successfully.${bonusNote}`,
      };
      return new Response(superjson.stringify(output));
    } else {
      // Reject
      if (!input.adminNotes) {
        return new Response(
          superjson.stringify({ error: "Admin notes (rejection reason) are required when rejecting." }),
          { status: 400 }
        );
      }

      const rejectionNote = input.adminNotes;
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable("contentReviews")
          .set({
            status: "rejected",
            reviewedBy: admin.id,
            reviewedAt: now,
            adminNotes: rejectionNote,
            updatedAt: now,
          })
          .where("id", "=", input.reviewId)
          .execute();
        await withdrawClaimsForReviews(trx, [input.reviewId], "The content was not approved.");
      });

      // Awaited: Floot drops a send still running after the response goes out.
      if (teacher?.email) {
        const contentTitle = await getContentTitle(review.contentType, review.contentId);
        await sendReviewEmail(
          teacher.email,
          teacher.displayName,
          review.contentType,
          review.contentId,
          contentTitle,
          "reject",
          input.adminNotes
        );
      }

      const output: OutputType = {
        success: true,
        message: "Content review rejected.",
      };
      return new Response(superjson.stringify(output));
    }
  } catch (error) {
    console.error("Error processing content review:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}