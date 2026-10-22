import { db } from "./db";
import { getBrandedEmailHtml } from "./emailBaseTemplate";
import { escapeHtmlAttribute as esc } from "./escapeHtmlAttribute";
import { sendEmail } from "./sendEmail";
import { CAMPAIGN_CONTENT_NOUNS, formatRupees, type CampaignContentType } from "./teacherCampaignRules";
import type { CampaignClaim } from "./teacherCampaign";

const PAGE_URL = "https://testkart.in/teacher/creator-bonus";

type Decision = "credited" | "declined" | "reversed";

function buildEmail(
  decision: Decision,
  name: string,
  noun: string,
  title: string,
  amount: string,
  note: string | null,
  bonus: string
) {
  const safeTitle = esc(title);
  const safeNote = note ? esc(note) : null;
  const noteHtml = safeNote ? `<p style="margin:12px 0 0;"><strong>Note from our team:</strong> ${safeNote}</p>` : "";
  switch (decision) {
    case "credited":
      return {
        subject: `${amount} ${bonus} added to your wallet`,
        heading: `Your ${bonus} is in`,
        accent: "success" as const,
        body: `<p style="margin:0;">Our team picked your ${noun} <strong>"${safeTitle}"</strong> for the ${esc(bonus)}. <strong>${amount}</strong> has been added to your wallet and can be withdrawn with your earnings.</p>`,
        text: `Hi ${name}, our team picked your ${noun} "${title}" for the ${bonus}. ${amount} has been added to your wallet.`,
      };
    case "declined":
      return {
        subject: `${bonus} update for "${title}"`,
        heading: "Not selected for the bonus this time",
        accent: "brand" as const,
        body: `<p style="margin:0;">Your ${noun} <strong>"${safeTitle}"</strong> was not selected for the ${esc(bonus)}.</p>${noteHtml}<p style="margin:12px 0 0;">You can improve it and claim once more with its next submission for review.</p>`,
        text: `Hi ${name}, your ${noun} "${title}" was not selected for the ${bonus}.${note ? ` Note: ${note}` : ""} You can improve it and claim once more with its next submission.`,
      };
    case "reversed":
      return {
        subject: `${bonus} for "${title}" reversed`,
        heading: `Your ${bonus} was reversed`,
        accent: "danger" as const,
        body: `<p style="margin:0;">The ${amount} ${esc(bonus)} for your ${noun} <strong>"${safeTitle}"</strong> has been taken back off your wallet balance.</p>${noteHtml}`,
        text: `Hi ${name}, the ${amount} ${bonus} for your ${noun} "${title}" has been taken back off your wallet balance.${note ? ` Reason: ${note}` : ""}`,
      };
  }
}

/** Emails the teacher about a bonus decision. Never throws; await it before the handler returns. */
export async function sendCampaignDecisionEmail(claim: CampaignClaim, decision: Decision): Promise<void> {
  try {
    const teacher = await db
      .selectFrom("users")
      .select(["displayName", "email"])
      .where("id", "=", claim.teacherId)
      .executeTakeFirst();
    if (!teacher?.email) return;
    const type = claim.contentType as CampaignContentType;
    const table = type === "mock_test" ? "mockTests" : "courses";
    const content = await db.selectFrom(table).select("title").where("id", "=", claim.contentId).executeTakeFirst();
    const campaign = await db.selectFrom("teacherCampaigns").select("title").where("id", "=", claim.campaignId).executeTakeFirst();
    const note = decision === "reversed" ? claim.reverseReason : decision === "declined" ? claim.decisionNote : null;
    const email = buildEmail(
      decision,
      teacher.displayName,
      CAMPAIGN_CONTENT_NOUNS[type] ?? "item",
      content?.title ?? "your content",
      formatRupees(Number(claim.amount)),
      note,
      campaign?.title ?? "Creator Bonus"
    );
    const html = getBrandedEmailHtml({
      title: email.subject,
      accent: email.accent,
      heading: email.heading,
      subheading: `Hi ${esc(teacher.displayName)}`,
      bodyHtml: email.body,
      ctaLabel: "Open Creator Bonus",
      ctaUrl: PAGE_URL,
    });
    const result = await sendEmail({
      to: teacher.email,
      subject: email.subject,
      html,
      text: `${email.text} ${PAGE_URL}`,
      idempotencyKey: `campaign-claim-${claim.id}-${decision}`,
    });
    if (!result.success) console.error(`Creator Bonus email for claim ${claim.id} failed:`, result.error);
  } catch (error) {
    console.error(`Creator Bonus email for claim ${claim.id} failed:`, error);
  }
}