import { db } from "./db";
import { alreadyInReviewMessage, queueContentReview } from "./contentReviewQueue";
import { createClaim } from "./teacherCampaign";
import { CAMPAIGN_CONTENT_NOUNS, formatRupees, type CampaignContentType } from "./teacherCampaignRules";

/**
 * Queues a test series or course for review, and with claimBonus also claims
 * a bonus in the same transaction: the Creator Bonus, or the Exam Bonus named by
 * examCampaignId. If the claim is refused, nothing is submitted and the teacher
 * sees why.
 */
export async function submitForReview(
  input: { contentType: CampaignContentType; contentId: number; teacherId: number },
  claimBonus: boolean,
  examCampaignId?: number
): Promise<{ ok: true; bonusNote: string } | { ok: false; error: string }> {
  if (!claimBonus) {
    await queueContentReview(db, input);
    return { ok: true, bonusNote: "" };
  }
  try {
    const claim = await db.transaction().execute(async (trx) => {
      const reviewId = await queueContentReview(trx, input);
      if (reviewId === null) throw new Error(alreadyInReviewMessage(CAMPAIGN_CONTENT_NOUNS[input.contentType]));
      return createClaim(trx, {
        teacherId: input.teacherId,
        type: input.contentType,
        contentId: input.contentId,
        reviewId,
        examCampaignId,
      });
    });
    return {
      ok: true,
      bonusNote: ` You also claimed the ${formatRupees(claim.amount)} ${claim.campaignTitle}. Approval and the bonus are separate decisions.`,
    };
  } catch (error) {
    return { ok: false, error: `Not submitted: ${error instanceof Error ? error.message : "the bonus could not be claimed."}` };
  }
}