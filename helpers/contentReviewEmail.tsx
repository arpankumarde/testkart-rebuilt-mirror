import { db } from "./db";
import { sendEmail } from "./sendEmail";

/* Approved/rejected emails for teacher content, shared by the review queue and the admin preview status actions. */

async function getEmailTemplate(templateKey: string) {
  return db
    .selectFrom("emailTemplates")
    .selectAll()
    .where("templateKey", "=", templateKey)
    .where("isActive", "=", true)
    .executeTakeFirst();
}

function replacePlaceholders(text: string, replacements: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

/** Never throws; a missing template or send failure is logged and skipped. */
export async function sendReviewEmail(
  teacherEmail: string,
  teacherName: string,
  contentType: string,
  contentTitle: string,
  action: "approve" | "reject",
  adminNotes?: string | null
) {
  const templateKey = action === "approve" ? "content_review_approved" : "content_review_rejected";

  try {
    const template = await getEmailTemplate(templateKey);
    if (!template) {
      console.warn(`Email template '${templateKey}' not found or inactive, skipping email.`);
      return;
    }

    const replacements: Record<string, string> = {
      displayName: teacherName,
      contentType: contentType.replace(/_/g, " "),
      contentTitle,
      adminNotes: adminNotes ?? "",
    };

    const html = replacePlaceholders(template.htmlContent, replacements);
    const text = template.textContent ? replacePlaceholders(template.textContent, replacements) : undefined;
    const subject = replacePlaceholders(template.subject, replacements);

    await sendEmail({ to: teacherEmail, subject, html, text });
  } catch (err) {
    console.error(`Failed to send review email (${templateKey}):`, err);
  }
}

export async function getContentTitle(contentType: string, contentId: number): Promise<string> {
  try {
    switch (contentType) {
      case "mock_test": {
        const row = await db.selectFrom("mockTests").select("title").where("id", "=", contentId).executeTakeFirst();
        return row?.title ?? "Unknown";
      }
      case "course": {
        const row = await db.selectFrom("courses").select("title").where("id", "=", contentId).executeTakeFirst();
        return row?.title ?? "Unknown";
      }
      case "digital_product": {
        const row = await db.selectFrom("digitalProducts").select("title").where("id", "=", contentId).executeTakeFirst();
        return row?.title ?? "Unknown";
      }
      case "course_bundle": {
        const row = await db.selectFrom("courseBundles").select("title").where("id", "=", contentId).executeTakeFirst();
        return row?.title ?? "Unknown";
      }
      case "live_test": {
        const row = await db.selectFrom("liveTests").select("title").where("id", "=", contentId).executeTakeFirst();
        return row?.title ?? "Unknown";
      }
      default:
        return "Unknown";
    }
  } catch {
    return "Unknown";
  }
}