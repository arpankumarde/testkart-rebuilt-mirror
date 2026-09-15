import { Resend } from "resend";
import { FROM_EMAIL } from "./_publicConfigs";

// Lazy-initialize Resend to avoid accessing process.env at module scope
// (process.env is only available on the server-side in Floot).
let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: {
    content?: string | Buffer;
    filename?: string | false | undefined;
    path?: string;
  }[];
};

export type SendEmailResult =
  | { success: true; data: any }
  | { success: false; error: any };

/**
 * Sends an email using the Resend SDK.
 * This function should only be called from server-side code (endpoints).
 */
export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  replyTo,
  cc,
  bcc,
  attachments,
}: SendEmailParams): Promise<SendEmailResult> => {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not defined in environment variables.");
    return {
      success: false,
      error: new Error("Email service configuration missing"),
    };
  }

  try {
        const data = await getResend().emails.send({
      from: `Testkart <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
      replyTo,
      cc,
      bcc,
      attachments,
    });

    if (data.error) {
      console.error("Resend API Error:", data.error);
      return { success: false, error: data.error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error };
  }
};
