import { createHmac, timingSafeEqual } from "crypto";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "./schema";

/**
 * Unsubscribe links for optional emails. A link carries `<userId>.<signature>`,
 * an HMAC of the user and list keyed on JWT_SECRET, so it works without signing
 * in and cannot be forged for someone else. Opting out writes an
 * email_unsubscribes row for that list; account, order and payout emails do not
 * check it.
 *
 * Server-only (reads JWT_SECRET).
 */

export const UNSUBSCRIBE_LISTS = ["teacher_onboarding"] as const;
export type UnsubscribeList = (typeof UNSUBSCRIBE_LISTS)[number];

export const isUnsubscribeList = (value: string): value is UnsubscribeList =>
  (UNSUBSCRIBE_LISTS as readonly string[]).includes(value);

const SITE_URL = "https://testkart.in";

const signature = (userId: number, list: UnsubscribeList) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set.");
  return createHmac("sha256", secret).update(`email-unsubscribe:${list}:${userId}`).digest("base64url");
};

export const unsubscribeToken = (userId: number, list: UnsubscribeList) =>
  `${userId}.${signature(userId, list)}`;

/** The user id a token was issued for, or null when it is malformed or forged. */
export const verifyUnsubscribeToken = (token: string, list: UnsubscribeList): number | null => {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [idPart, given] = parts;
  const userId = Number(idPart);
  if (!/^\d+$/.test(idPart) || !Number.isSafeInteger(userId) || userId <= 0 || !given) return null;
  const expected = Buffer.from(signature(userId, list));
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? userId : null;
};

/** The page a person opens from the email footer; it asks before opting out. */
export const unsubscribePageUrl = (userId: number, list: UnsubscribeList) =>
  `${SITE_URL}/email/unsubscribe?list=${list}&t=${encodeURIComponent(unsubscribeToken(userId, list))}`;

/** RFC 8058 one-click target for the List-Unsubscribe header. */
export const unsubscribeHeaders = (userId: number, list: UnsubscribeList): Record<string, string> => ({
  "List-Unsubscribe": `<${SITE_URL}/_api/email/unsubscribe?list=${list}&t=${encodeURIComponent(unsubscribeToken(userId, list))}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

export async function recordUnsubscribe(
  executor: Kysely<DB> | Transaction<DB>,
  userId: number,
  list: UnsubscribeList
): Promise<void> {
  await executor
    .insertInto("emailUnsubscribes")
    .values({ userId, list })
    .onConflict((oc) => oc.columns(["userId", "list"]).doNothing())
    .execute();
}
