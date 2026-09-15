import { db } from "./db";
import { sendEmail } from "./sendEmail";
import { welcomeStudent, welcomeTeacher } from "./emailTemplates";
import { addContactToAudience } from "./resendContacts";

export type SendOAuthWelcomeEmailParams = {
  userDisplayName: string;
  userEmail: string;
  userId: number;
  role: "student" | "teacher";
};

/**
 * Sends welcome email and syncs contact to Resend for new OAuth users.
 * This function is non-blocking and logs errors without throwing.
 */
export async function sendOAuthWelcomeEmail({
  userDisplayName,
  userEmail,
  userId,
  role,
}: SendOAuthWelcomeEmailParams): Promise<void> {
  // Sync contact to Resend (non-blocking)
  const firstName = userDisplayName.split(" ")[0];
  addContactToAudience(userEmail, firstName, role, userId)
    .then((result) => {
      if (result.success) {
        console.log(`OAuth contact synced to Resend: ${userEmail}`);
      } else {
        console.error(`Failed to sync OAuth contact to Resend:`, result.error);
      }
    })
    .catch((err) =>
      console.error("Failed to sync OAuth contact to Resend:", err)
    );

  // Send welcome email (non-blocking)
  const sendEmail_async = async () => {
    try {
      const templateKey =
        role === "student" ? "welcome_student" : "welcome_teacher";

      // Fetch email template from database
      const template = await db
        .selectFrom("emailTemplates")
        .selectAll()
        .where("templateKey", "=", templateKey)
        .where("isActive", "=", true)
        .executeTakeFirst();

      let subject: string;
      let html: string;
      let text: string;

      if (template) {
        const replacePlaceholders = (
          str: string,
          data: Record<string, string>
        ) => {
          return Object.entries(data).reduce(
            (acc, [key, value]) =>
              acc.replace(new RegExp(`{{${key}}}`, "g"), value),
            str
          );
        };

        const placeholders = {
          displayName: userDisplayName,
          email: userEmail,
        };

        subject = replacePlaceholders(template.subject, placeholders);
        html = replacePlaceholders(template.htmlContent, placeholders);
        text = replacePlaceholders(template.textContent || "", placeholders);
      } else {
        console.warn(
          `${templateKey} template not found in database, using fallback`
        );
        const emailTemplate =
          role === "student"
            ? welcomeStudent(userDisplayName, userEmail)
            : welcomeTeacher(userDisplayName, userEmail);
        subject = emailTemplate.subject;
        html = emailTemplate.html;
        text = emailTemplate.text;
      }

      const result = await sendEmail({
        to: userEmail,
        subject,
        html,
        text,
      });

      if (result.success) {
        console.log(
          `Welcome email sent successfully to ${userEmail} via OAuth`
        );
      } else {
        console.error(
          `Failed to send welcome email to ${userEmail}:`,
          result.error
        );
      }
    } catch (error) {
      console.error(
        `Error sending welcome email to ${userEmail}:`,
        error
      );
    }
  };

  sendEmail_async();
}