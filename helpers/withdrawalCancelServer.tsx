import { sql, type Kysely } from "kysely";
import { db } from "./db";
import type { DB, WithdrawalStatus } from "./schema";

/*
 * Withdrawal requests and their status changes. Balances are derived: a
 * withdrawal counts against the wallet only while it is pending or completed
 * (getStudentAvailableBalance, getTeacherAvailableBalance), so moving a pending
 * request to "cancelled" is what returns its amount, and it can happen once.
 * Every creation and status change is logged by database triggers into
 * withdrawal_status_history; setWithdrawalActor names who did it.
 */

export type WithdrawalActor = {
  userId: number | null;
  adminId: number | null;
  source: "user" | "admin" | "admin_impersonation";
};

/* Must run inside the transaction that writes the withdrawal; outside one it is lost and the change logs as "system". */
export async function setWithdrawalActor(trx: Kysely<DB>, actor: WithdrawalActor): Promise<void> {
  await sql`select
    set_config('tk.wd_actor_user', ${actor.userId === null ? "" : String(actor.userId)}, true),
    set_config('tk.wd_actor_admin', ${actor.adminId === null ? "" : String(actor.adminId)}, true),
    set_config('tk.wd_actor_source', ${actor.source}, true)`.execute(trx);
}

/* The signed-in account, or the admin signed in as it. */
export const withdrawalUserActor = (userId: number, impersonatorAdminId: number | null | undefined): WithdrawalActor =>
  impersonatorAdminId != null
    ? { userId, adminId: impersonatorAdminId, source: "admin_impersonation" }
    : { userId, adminId: null, source: "user" };

export class WithdrawalCancelError extends Error {
  constructor(message: string, readonly status: 404 | 409) {
    super(message);
    this.name = "WithdrawalCancelError";
  }
}

const REFUSALS: Record<WithdrawalStatus, string> = {
  pending: "This request could not be cancelled. Refresh the page and try again.",
  completed: "This withdrawal has already been paid, so it can no longer be cancelled.",
  failed: "This withdrawal was rejected, so its amount is already back in your balance.",
  cancelled: "This withdrawal request is already cancelled.",
};

const LOCK_TIMEOUT = "55P03";

/*
 * Cancels one pending request owned by ownerId. A single conditional UPDATE
 * does it: an admin approving or rejecting the same request holds its row lock,
 * so this waits, then finds the new status and changes nothing. A repeated call
 * finds it already cancelled. Nothing else is written, so a refusal leaves
 * every balance as it was.
 */
export async function cancelPendingWithdrawal(
  kind: "student" | "teacher",
  withdrawalId: number,
  ownerId: number,
  actor: WithdrawalActor
) {
  try {
    return await db.transaction().execute(async (trx) => {
      await sql`set local lock_timeout = '5s'`.execute(trx);
      await setWithdrawalActor(trx, actor);
      const now = new Date();
      const changes = {
        status: "cancelled" as const,
        cancelledAt: now,
        cancelledByUserId: actor.userId,
        cancelledByAdminId: actor.adminId,
        updatedAt: now,
      };
      const updated =
        kind === "student"
          ? await trx
              .updateTable("studentWithdrawals")
              .set(changes)
              .where("id", "=", withdrawalId)
              .where("studentId", "=", ownerId)
              .where("status", "=", "pending")
              .returningAll()
              .executeTakeFirst()
          : await trx
              .updateTable("teacherWithdrawals")
              .set(changes)
              .where("id", "=", withdrawalId)
              .where("teacherId", "=", ownerId)
              .where("status", "=", "pending")
              .returningAll()
              .executeTakeFirst();
      if (updated) return updated;

      // Another account's request reads as not found, so ids cannot be probed.
      const current =
        kind === "student"
          ? await trx.selectFrom("studentWithdrawals").select("status").where("id", "=", withdrawalId).where("studentId", "=", ownerId).executeTakeFirst()
          : await trx.selectFrom("teacherWithdrawals").select("status").where("id", "=", withdrawalId).where("teacherId", "=", ownerId).executeTakeFirst();
      if (!current) throw new WithdrawalCancelError("Withdrawal request not found.", 404);
      throw new WithdrawalCancelError(REFUSALS[current.status], 409);
    });
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === LOCK_TIMEOUT) {
      throw new WithdrawalCancelError("This request is being processed right now. Refresh the page in a moment.", 409);
    }
    throw error;
  }
}