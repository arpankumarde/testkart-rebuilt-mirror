import { db } from "./db";
import { WAPLIFY_ENDPOINT } from "./_publicConfigs";
import { isPlaceholderDisplayName } from "./isPlaceholderDisplayName";

const API_BASE = `${WAPLIFY_ENDPOINT}/api/v1`;
const CALL_TIMEOUT_MS = 4000;
const TOTAL_TIMEOUT_MS = 9000;
const ROLE_TAGS: Record<string, string> = { student: "Student", teacher: "Teacher" };

type WaplifyContact = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  tags?: string[] | null;
};

/** Waplify wants 91XXXXXXXXXX (no +); null when the number is not a valid Indian mobile. */
export function toWaplifyPhone(mobileNumber: string): string | null {
  let digits = mobileNumber.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : null;
}

async function waplify(apiKey: string, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
}

async function describeFailure(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return `${res.status} ${text.slice(0, 300)}`;
}

async function upsertContact(
  apiKey: string,
  userId: number,
  phone: string,
  tag: string,
  name: string | null,
  email: string | null
): Promise<void> {
  const [firstName, ...rest] = (name ?? tag).split(" ");
  const lastName = rest.join(" ");

  const created = await waplify(apiKey, "POST", "/contacts/", {
    phone_number: phone,
    first_name: firstName,
    ...(lastName ? { last_name: lastName } : {}),
    ...(email ? { email } : {}),
    tags: [tag],
  });
  if (created.ok) {
    console.log(`[waplify-contact] user ${userId}: contact created (${tag})`);
    return;
  }
  const createFailure = await describeFailure(created);

  const found = await waplify(apiKey, "GET", `/contacts/phone/${phone}`);
  if (!found.ok) {
    console.error(
      `[waplify-contact] user ${userId}: create failed (${createFailure}), lookup failed (${await describeFailure(found)})`
    );
    return;
  }
  const contact = ((await found.json()) as { contact?: WaplifyContact }).contact ?? {};

  const update: Record<string, unknown> = {};
  if (name) {
    if ((contact.first_name ?? "") !== firstName) update.first_name = firstName;
    if ((contact.last_name ?? "") !== lastName) update.last_name = lastName;
  }
  if (email && (contact.email ?? "").toLowerCase() !== email.toLowerCase()) update.email = email;
  const tags = Array.isArray(contact.tags) ? contact.tags : [];
  if (!tags.includes(tag)) update.tags = [...tags, tag];
  if (Object.keys(update).length === 0) return;

  const updated = await waplify(apiKey, "PUT", `/contacts/phone/${phone}`, update);
  if (updated.ok) {
    console.log(`[waplify-contact] user ${userId}: contact updated (${Object.keys(update).join(", ")})`);
  } else {
    console.error(`[waplify-contact] user ${userId}: update failed (${await describeFailure(updated)})`);
  }
}

/**
 * Mirrors a student's or teacher's name, email and role tag ("Student" /
 * "Teacher") onto their Waplify contact, keyed by mobile number. Creates the
 * contact or updates the one already there, keeping its other tags. Accounts
 * without a valid Indian mobile, suspended accounts and admins are skipped, and
 * a placeholder name (User_123) never overwrites a real one.
 *
 * Waplify is not critical: this never throws, each call gives up after 4
 * seconds and the whole sync after 9, so an outage or an API error is only
 * logged and never fails or stalls the caller. Await it after the user row is
 * committed: Floot refuses fetches started after the handler returns.
 */
export async function syncWaplifyContact(userId: number): Promise<void> {
  try {
    const apiKey = process.env.WAPLIFY_API_KEY;
    if (!apiKey) {
      console.warn("[waplify-contact] WAPLIFY_API_KEY is not set, skipping");
      return;
    }

    const user = await db
      .selectFrom("users")
      .select(["role", "displayName", "email", "mobileNumber", "isActive"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user || user.isActive === false || !user.mobileNumber) return;
    const tag = ROLE_TAGS[user.role];
    if (!tag) return;

    const phone = toWaplifyPhone(user.mobileNumber);
    if (!phone) {
      console.warn(`[waplify-contact] user ${userId}: mobile number is not a valid Indian number, skipping`);
      return;
    }

    const rawName = (user.displayName ?? "").trim().replace(/\s+/g, " ");
    const name = rawName && !isPlaceholderDisplayName(rawName) && !/^user$/i.test(rawName) ? rawName : null;
    const email = user.email?.trim() || null;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const gaveUp = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        console.warn(`[waplify-contact] user ${userId}: gave up after ${TOTAL_TIMEOUT_MS}ms`);
        resolve();
      }, TOTAL_TIMEOUT_MS);
    });
    const work = upsertContact(apiKey, userId, phone, tag, name, email).catch((error) => {
      console.error(`[waplify-contact] user ${userId}: sync failed`, error);
    });
    await Promise.race([work, gaveUp]);
    clearTimeout(timer);
  } catch (error) {
    console.error(`[waplify-contact] user ${userId}: sync failed`, error);
  }
}
