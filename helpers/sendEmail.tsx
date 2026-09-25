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
  /** Display name in the From header. Defaults to "Testkart". */
  fromName?: string;
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
  /** Resend drops a repeat send with the same key for 24 hours. */
  idempotencyKey?: string;
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
  fromName,
  headers,
  tags,
  idempotencyKey,
}: SendEmailParams): Promise<SendEmailResult> => {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not defined in environment variables.");
    return {
      success: false,
      error: new Error("Email service configuration missing"),
    };
  }

  try {
    const data = await getResend().emails.send(
      {
        from: `${fromName ?? "Testkart"} <${FROM_EMAIL}>`,
        to,
        subject,
        html,
        text,
        replyTo,
        cc,
        bcc,
        attachments,
        headers,
        tags,
      },
      idempotencyKey ? { idempotencyKey } : undefined
    );

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
