import type { Kysely } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";
import { accountBlockedMessage, getAccountStatus } from "./accountStatus";

/**
 * The sign-in refusal for a suspended or banned account, or null when the account may sign in.
 * Login endpoints call this before creating a session; getServerUserSession checks the same
 * columns on every request, so a session that slips through still gets refused.
 *
 * A suspension whose end date has passed is cleared here, the first time the user signs in
 * again, so users.is_active (which teacher search and the homepage filter on) is true again.
 */
export async function getAccountBlockMessage(
  userId: number,
  executor: Kysely<DB> = db
): Promise<string | null> {
  const row = await executor
    .selectFrom("users")
    .select(["isActive", "suspensionKind", "suspendedUntil"])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!row) return null;
  if (getAccountStatus(row) === "active") {
    if (!row.isActive) await clearEndedSuspension(userId, executor);
    return null;
  }
  return accountBlockedMessage(row);
}

async function clearEndedSuspension(userId: number, executor: Kysely<DB>) {
  const now = new Date();
  const cleared = await executor
    .updateTable("users")
    .set({
      isActive: true,
      suspensionKind: null,
      suspendedUntil: null,
      suspensionReason: null,
      suspendedAt: null,
      suspendedBy: null,
      updatedAt: now,
    })
    .where("id", "=", userId)
    .where("isActive", "=", false)
    .where("suspensionKind", "=", "suspended")
    .where("suspendedUntil", "<=", now)
    .executeTakeFirst();
  if (Number(cleared.numUpdatedRows) > 0) {
    await executor
      .insertInto("userAccountActions")
      .values({ userId, action: "reactivated", reason: "Suspension period ended", adminName: "Automatic" })
      .execute();
  }
}