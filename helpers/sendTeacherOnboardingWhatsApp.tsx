import { WAPLIFY_ENDPOINT } from "./_publicConfigs";
import { syncWaplifyContact, toWaplifyPhone } from "./syncWaplifyContact";

const API_BASE = `${WAPLIFY_ENDPOINT}/api/v1`;
/** UTILITY account-setup message (submitted 20-11-2026); takes the teacher's name as {{1}}. */
const UTILITY_TEMPLATE = "teacher_account_ready";
/** The original MARKETING welcome, sent when the utility one is refused (for example still in Meta review). */
const MARKETING_TEMPLATE = "newly_onboard_teachers";
const MEDIA_URL = "https://cdn.testkart.in/platform/marketing/teacher-onboarding.jpg";
const TIMEOUT_MS = 4000;

/**
 * Saves a newly signed-up teacher as a Waplify contact tagged "Teacher"
 * (helpers/syncWaplifyContact), then sends the "teacher_account_ready"
 * utility template, or the "newly_onboard_teachers" marketing one when
 * Waplify refuses the first (not approved yet). Both use the same image.
 * Never throws, and each Waplify call gives up after 4 seconds, so a Waplify
 * outage or a bad number can never fail the signup; a timeout is not retried
 * with the other template. A failed contact step still lets the message go out.
 * Await it after the account is created: Floot refuses fetches started after
 * the handler returns.
 */
export async function sendTeacherOnboardingWhatsApp(params: {
  userId: number;
  mobileNumber: string | null | undefined;
  name: string | null | undefined;
  email?: string | null;
}): Promise<void> {
  try {
    const apiKey = process.env.WAPLIFY_API_KEY;
    if (!apiKey) {
      console.warn("[teacher-whatsapp] WAPLIFY_API_KEY is not set, skipping");
      return;
    }
    if (!params.mobileNumber) return;

    const phone = toWaplifyPhone(params.mobileNumber);
    if (!phone) {
      console.warn(`[teacher-whatsapp] user ${params.userId}: mobile number is not a valid Indian number, skipping`);
      return;
    }

    const rawName = params.name?.trim() ?? "";
    const name = rawName && !/^User_\d+$/.test(rawName) ? rawName : "Teacher";

    await syncWaplifyContact(params.userId);

    const send = (template: string, bodyData: Record<string, string>) =>
      fetch(`${API_BASE}/messages/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          template_name: template,
          contact_phone: phone,
          contact_name: name,
          body_data: bodyData,
          media_url: MEDIA_URL,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

    let template = UTILITY_TEMPLATE;
    let sent = await send(UTILITY_TEMPLATE, { "1": name.split(/\s+/)[0].slice(0, 60) });
    if (!sent.ok) {
      const reason = await sent.text().catch(() => "");
      console.warn(`[teacher-whatsapp] user ${params.userId}: ${UTILITY_TEMPLATE} refused (${sent.status} ${reason.slice(0, 200)}), sending ${MARKETING_TEMPLATE}`);
      template = MARKETING_TEMPLATE;
      sent = await send(MARKETING_TEMPLATE, {});
    }
    if (sent.ok) {
      console.log(`[teacher-whatsapp] user ${params.userId}: onboarding message sent (${template})`);
    } else {
      const text = await sent.text().catch(() => "");
      console.error(`[teacher-whatsapp] user ${params.userId}: message send failed (${sent.status} ${text.slice(0, 500)})`);
    }
  } catch (error) {
    console.error(`[teacher-whatsapp] user ${params.userId}: send failed`, error);
  }
}
