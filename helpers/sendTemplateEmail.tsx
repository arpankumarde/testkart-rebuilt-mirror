import { db } from "./db";
import { sendEmail } from "./sendEmail";

export const ADMIN_EMAIL = "teamtestkart@gmail.com";

/**
 * Sends an email using a template stored in the database.
 * 
 * @param templateKey - The unique key of the template in the `emailTemplates` table
 * @param to - The recipient email address(es)
 * @param placeholders - A record of placeholders to replace in the subject and content (e.g. { name: 'John' } replaces {{name}})
 * @returns A promise that resolves to an object indicating success or failure
 */
export async function sendTemplateEmail(
  templateKey: string,
  to: string | string[],
  placeholders: Record<string, string>
): Promise<{ success: boolean; skipped?: boolean }> {
  try {
    const template = await db
      .selectFrom("emailTemplates")
      .selectAll()
      .where("templateKey", "=", templateKey)
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (!template) {
      console.warn(`Email template '${templateKey}' not found or is inactive. Skipping email.`);
      return { success: false, skipped: true };
    }

    let subject = template.subject;
    let htmlContent = template.htmlContent;
    let textContent = template.textContent || undefined;

    // Replace all placeholders in the subject and body
    for (const [key, value] of Object.entries(placeholders)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, value);
      htmlContent = htmlContent.replace(regex, value);
      if (textContent) {
        textContent = textContent.replace(regex, value);
      }
    }

    const result = await sendEmail({
      to,
      subject,
      html: htmlContent,
      text: textContent,
    });

    return { success: result.success };
  } catch (error) {
    console.error(`Failed to send template email '${templateKey}':`, error);
    return { success: false };
  }
}