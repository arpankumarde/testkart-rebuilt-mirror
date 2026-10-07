import { db } from "./db";
import { getBrandedEmailHtml } from "./emailBaseTemplate";
import { escapeHtmlAttribute as esc } from "./escapeHtmlAttribute";
import { sendEmail } from "./sendEmail";
import { CAMPAIGN_CONTENT_NOUNS, formatRupees, type CampaignContentType } from "./teacherCampaignRules";
import type { CampaignClaim } from "./teacherCampaign";

const PAGE_URL = "https://testkart.in/teacher/creator-bonus";

type Decision = "credited" | "declined" | "reversed";

function buildEmail(decision: Decision, name: string, noun: string, title: string, amount: string, note: string | null) {
  const safeTitle = esc(title);
  const safeNote = note ? esc(note) : null;
  const noteHtml = safeNote ? `<p style="margin:12px 0 0;"><strong>Note from our team:</strong> ${safeNote}</p>` : "";
  switch (decision) {
    case "credited":
      return {
        subject: `${amount} Creator Bonus added to your wallet`,
        heading: "Your Creator Bonus is in",
        accent: "success" as const,
        body: `<p style="margin:0;">Our team picked your ${noun} <strong>"${safeTitle}"</strong> for the Creator Bonus. <strong>${amount}</strong> has been added to your wallet and can be withdrawn with your earnings.</p>`,
        text: `Hi ${name}, our team picked your ${noun} "${title}" for the Creator Bonus. ${amount} has been added to your wallet.`,
      };
    case "declined":
      return {
        subject: `Creator Bonus update for "${title}"`,
        heading: "Not selected for the bonus this time",
        accent: "brand" as const,
        body: `<p style="margin:0;">Your ${noun} <strong>"${safeTitle}"</strong> was not selected for the Creator Bonus.</p>${noteHtml}<p style="margin:12px 0 0;">You can improve it and claim once more with its next submission for review.</p>`,
        text: `Hi ${name}, your ${noun} "${title}" was not selected for the Creator Bonus.${note ? ` Note: ${note}` : ""} You can improve it and claim once more with its next submission.`,
      };
    case "reversed":
      return {
        subject: `Creator Bonus for "${title}" reversed`,
        heading: "A Creator Bonus was reversed",
        accent: "danger" as const,
        body: `<p style="margin:0;">The ${amount} Creator Bonus for your ${noun} <strong>"${safeTitle}"</strong> has been taken back off your wallet balance.</p>${noteHtml}`,
        text: `Hi ${name}, the ${amount} Creator Bonus for your ${noun} "${title}" has been taken back off your wallet balance.${note ? ` Reason: ${note}` : ""}`,
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
    const note = decision === "reversed" ? claim.reverseReason : decision === "declined" ? claim.decisionNote : null;
    const email = buildEmail(
      decision,
      teacher.displayName,
      CAMPAIGN_CONTENT_NOUNS[type] ?? "item",
      content?.title ?? "your content",
      formatRupees(Number(claim.amount)),
      note
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