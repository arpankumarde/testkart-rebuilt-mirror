import { sendEmail } from "./sendEmail";
import { welcomeStudent } from "./emailTemplates";
import { addContactToAudience } from "./resendContacts";

export type SendOAuthWelcomeEmailParams = {
  userDisplayName: string;
  userEmail: string;
  userId: number;
  role: "student" | "teacher";
};

/**
 * Syncs a new OAuth user to Resend and sends students their welcome email.
 * Teachers get theirs as email 1 of the onboarding sequence (helpers/teacherOnboarding).
 * Await it before the handler returns: Floot drops work left running after the
 * response. Runs both sends together and logs errors without throwing.
 */
export async function sendOAuthWelcomeEmail({
  userDisplayName,
  userEmail,
  userId,
  role,
}: SendOAuthWelcomeEmailParams): Promise<void> {
  const firstName = userDisplayName.split(" ")[0];
  const contactSync = addContactToAudience(userEmail, firstName, role, userId)
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

  if (role !== "student") {
    await contactSync;
    return;
  }

  const sendWelcome = async () => {
    try {
      const emailTemplate = welcomeStudent(userDisplayName, userEmail);
      const result = await sendEmail({ to: userEmail, ...emailTemplate });

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

  await Promise.all([contactSync, sendWelcome()]);
}
