import { db } from "./db";
import { sendEmail } from "./sendEmail";
import { withStudentAppPromo } from "./emailBaseTemplate";
import { renderStudentTemplateEmail } from "./studentTemplateEmails";

export const ADMIN_EMAIL = "teamtestkart@gmail.com";

// Templates that only ever go to students. They are built in code
// (helpers/studentTemplateEmails) and have no row in the email_templates table.
const STUDENT_TEMPLATE_KEYS = new Set([
  "welcome_student",
  "live_test_reminder",
  "live_test_results",
  "review_reminder",
  "student_bank_details_verified",
  "student_bank_details_rejected",
  "student_withdrawal_requested",
  "wallet_credit_received",
]);

/**
 * Sends a templated email. Student emails come from code; everything else is
 * read from the `emailTemplates` table, where admins can edit it.
 *
 * @param templateKey - The unique key of the template
 * @param to - The recipient email address(es)
 * @param placeholders - A record of placeholders to replace in the subject and content (e.g. { name: 'John' } replaces {{name}})
 * @param options.studentAppPromo - Marks the recipient as a student. Defaults to true for
 *   student-only templates; pass it for templates shared by students and teachers, so a
 *   student gets the student version when one exists.
 * @returns A promise that resolves to an object indicating success or failure
 */
export async function sendTemplateEmail(
  templateKey: string,
  to: string | string[],
  placeholders: Record<string, string>,
  options: { studentAppPromo?: boolean } = {}
): Promise<{ success: boolean; skipped?: boolean }> {
  try {
    const forStudent = options.studentAppPromo ?? STUDENT_TEMPLATE_KEYS.has(templateKey);

    if (forStudent) {
      const rendered = renderStudentTemplateEmail(templateKey, placeholders);
      if (rendered) {
        const result = await sendEmail({ to, ...rendered });
        return { success: result.success };
      }
    }

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

    if (forStudent) {
      htmlContent = withStudentAppPromo(htmlContent);
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
