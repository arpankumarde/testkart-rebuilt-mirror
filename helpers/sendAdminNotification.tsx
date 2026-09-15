import { sendEmail } from "./sendEmail";
import { getBrandedEmailHtml, EmailTableRow } from "./emailBaseTemplate";

const ADMIN_EMAIL = "teamtestkart@gmail.com";

export type AdminNotificationType =
  | "teacher_verification"
  | "student_verification"
  | "teacher_withdrawal"
  | "student_withdrawal";

export interface AdminNotificationDetails {
  userName: string;
  userEmail?: string | null;
  userId: number;
  amount?: number;
}

/**
 * Sends a notification email to the admin team for critical platform events.
 * This is a fire-and-forget server-side helper. It catches and logs errors internally.
 */
export const sendAdminNotification = async (
  type: AdminNotificationType,
  details: AdminNotificationDetails
): Promise<void> => {
  try {
    let subject = "";
    let message = "";
    let link = "";

    switch (type) {
      case "teacher_verification":
        subject = "New Teacher Verification Request";
        message = `Teacher ${details.userName} (ID: ${details.userId}) has submitted bank details for verification.`;
        link = "/admin/teachers/bank-details";
        break;
      case "student_verification":
        subject = "New Student Verification Request";
        message = `Student ${details.userName} (ID: ${details.userId}) has submitted bank details for verification.`;
        link = "/admin/students/bank-details";
        break;
      case "teacher_withdrawal":
        subject = "New Teacher Withdrawal Request";
        message = `Teacher ${details.userName} (ID: ${details.userId}) has requested a withdrawal of ₹${details.amount ?? 0}.`;
        link = "/admin/teachers/withdrawals";
        break;
      case "student_withdrawal":
        subject = "New Student Withdrawal Request";
        message = `Student ${details.userName} (ID: ${details.userId}) has requested a withdrawal of ₹${details.amount ?? 0}.`;
        link = "/admin/students/withdrawals";
        break;
    }

    const tableRows: EmailTableRow[] = [
      { label: "Name", value: details.userName, emphasize: true },
      { label: "User ID", value: String(details.userId) },
      ...(details.userEmail ? [{ label: "Email", value: details.userEmail }] : []),
      ...(details.amount ? [{ label: "Amount", value: `₹${details.amount}` }] : []),
    ];

    const html = getBrandedEmailHtml({
      title: "Testkart Admin Alert",
      icon: "🔔",
      accent: "info",
      heading: "Admin Alert",
      subheading: message,
      table: tableRows,
      ctaLabel: "View Details",
      ctaUrl: `https://testkart.in${link}`,
      footerNote: "This is an automated notification from the Testkart platform.",
    });

    const result = await sendEmail({
      to: ADMIN_EMAIL,
      subject: subject,
      html: html,
    });

    if (!result.success) {
      console.error(`Failed to send admin notification (${type}):`, result.error);
    } else {
      console.log(`Successfully sent admin notification (${type}) for user ID ${details.userId}`);
    }
  } catch (error) {
    console.error(`Unexpected error while sending admin notification (${type}):`, error);
  }
};