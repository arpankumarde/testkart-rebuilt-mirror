import { WAPLIFY_ENDPOINT } from "./_publicConfigs";

const API_BASE = `${WAPLIFY_ENDPOINT}/api/v1`;
const TEMPLATE_NAME = "newly_onboard_teachers";
const MEDIA_URL = "https://cdn.testkart.in/platform/marketing/teacher-onboarding.jpg";
const TEACHER_TAG = "Teacher";
const TIMEOUT_MS = 4000;

type WaplifyContact = { tags?: string[] | null };

function toWaplifyPhone(mobileNumber: string): string | null {
  let digits = mobileNumber.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : null;
}

async function waplify(apiKey: string, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function describeFailure(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return `${res.status} ${text.slice(0, 500)}`;
}

async function upsertTeacherContact(
  apiKey: string,
  userId: number,
  phone: string,
  name: string,
  email: string | null | undefined
): Promise<void> {
  const [firstName, ...rest] = name.split(/\s+/);
  const created = await waplify(apiKey, "POST", "/contacts/", {
    phone_number: phone,
    first_name: firstName,
    ...(rest.length ? { last_name: rest.join(" ") } : {}),
    ...(email ? { email } : {}),
    tags: [TEACHER_TAG],
  });
  if (created.ok) {
    console.log(`[teacher-whatsapp] user ${userId}: contact created with tag ${TEACHER_TAG}`);
    return;
  }
  const createFailure = await describeFailure(created);

  const found = await waplify(apiKey, "GET", `/contacts/phone/${phone}`);
  if (!found.ok) {
    console.error(
      `[teacher-whatsapp] user ${userId}: contact create failed (${createFailure}), lookup failed (${await describeFailure(found)})`
    );
    return;
  }
  const payload = (await found.json()) as { contact?: WaplifyContact };
  const tags = Array.isArray(payload.contact?.tags) ? payload.contact!.tags! : [];
  if (tags.includes(TEACHER_TAG)) return;

  const updated = await waplify(apiKey, "PUT", `/contacts/phone/${phone}`, {
    tags: [...tags, TEACHER_TAG],
  });
  if (updated.ok) {
    console.log(`[teacher-whatsapp] user ${userId}: tag ${TEACHER_TAG} added to existing contact`);
  } else {
    console.error(`[teacher-whatsapp] user ${userId}: tag update failed (${await describeFailure(updated)})`);
  }
}

/**
 * Saves a newly signed-up teacher as a Waplify contact tagged "Teacher", then
 * sends the "newly_onboard_teachers" WhatsApp template. Never throws, and each
 * Waplify call gives up after 4 seconds, so a Waplify outage or a bad number can
 * never fail the signup. A failed contact step still lets the message go out.
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

    try {
      await upsertTeacherContact(apiKey, params.userId, phone, name, params.email);
    } catch (error) {
      console.error(`[teacher-whatsapp] user ${params.userId}: contact step failed`, error);
    }

    const sent = await waplify(apiKey, "POST", "/messages/send", {
      template_name: TEMPLATE_NAME,
      contact_phone: phone,
      contact_name: name,
      body_data: {},
      media_url: MEDIA_URL,
    });
    if (sent.ok) {
      console.log(`[teacher-whatsapp] user ${params.userId}: onboarding message sent`);
    } else {
      console.error(`[teacher-whatsapp] user ${params.userId}: message send failed (${await describeFailure(sent)})`);
    }
  } catch (error) {
    console.error(`[teacher-whatsapp] user ${params.userId}: send failed`, error);
  }
}
