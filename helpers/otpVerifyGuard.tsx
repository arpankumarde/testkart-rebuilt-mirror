import { randomInt } from "crypto";
import { sql } from "kysely";
import { db } from "./db";

/**
 * Brute-force protection shared by every OTP verify endpoint.
 *
 * - claimOtpAttempt counts an attempt against the OTP row before its code is
 *   compared. The increment and the limit check are one UPDATE, so many
 *   simultaneous guesses cannot all read the same stale attempt count.
 * - checkOtpVerifyLimit / recordOtpVerifyFailure cap wrong codes per mobile
 *   number or email and per source IP across OTP rows, since requesting a new
 *   code resets the per-row count.
 */

export const MAX_OTP_VERIFY_ATTEMPTS = 5;

const FAILURE_WINDOW_MS = 60 * 60 * 1000;
const FAILURE_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_FAILURES_PER_IDENTIFIER = 10;
const MAX_FAILURES_PER_IP = 50;

/** A numeric code of exactly `digits` digits from the CSPRNG. */
export function generateOtpCode(digits: number): string {
  return randomInt(10 ** (digits - 1), 10 ** digits).toString();
}

/**
 * Uses up one attempt on an unverified OTP row and returns its stored code, or
 * null when the row has no attempts left or was already verified.
 */
export async function claimOtpAttempt(kind: "mobile" | "email", otpId: number): Promise<string | null> {
  const row =
    kind === "mobile"
      ? await db
          .updateTable("mobileOtps")
          .set({ attempts: sql`${sql.ref("attempts")} + 1` })
          .where("id", "=", otpId)
          .where("attempts", "<", MAX_OTP_VERIFY_ATTEMPTS)
          .where("verifiedAt", "is", null)
          .returning("otpCode")
          .executeTakeFirst()
      : await db
          .updateTable("emailOtps")
          .set({ attempts: sql`${sql.ref("attempts")} + 1` })
          .where("id", "=", otpId)
          .where("attempts", "<", MAX_OTP_VERIFY_ATTEMPTS)
          .where("verifiedAt", "is", null)
          .returning("otpCode")
          .executeTakeFirst();

  return row?.otpCode ?? null;
}

/** Returns an error message when the identifier or IP has too many recent wrong codes. */
export async function checkOtpVerifyLimit(identifier: string, ipAddress: string | null): Promise<string | null> {
  const since = new Date(Date.now() - FAILURE_WINDOW_MS);

  const identifierFailures = await db
    .selectFrom("otpVerifyFailures")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("identifier", "=", identifier)
    .where("createdAt", ">=", since)
    .executeTakeFirst();

  if (Number(identifierFailures?.count ?? 0) >= MAX_FAILURES_PER_IDENTIFIER) {
    return "Too many incorrect codes. Please try again in an hour.";
  }

  if (ipAddress) {
    const ipFailures = await db
      .selectFrom("otpVerifyFailures")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("ipAddress", "=", ipAddress)
      .where("createdAt", ">=", since)
      .executeTakeFirst();

    if (Number(ipFailures?.count ?? 0) >= MAX_FAILURES_PER_IP) {
      return "Too many incorrect codes from your network. Please try again in an hour.";
    }
  }

  return null;
}

export async function recordOtpVerifyFailure(identifier: string, ipAddress: string | null): Promise<void> {
  await db.insertInto("otpVerifyFailures").values({ identifier, ipAddress }).execute();
  await db
    .deleteFrom("otpVerifyFailures")
    .where("createdAt", "<", new Date(Date.now() - FAILURE_RETENTION_MS))
    .execute();
}
