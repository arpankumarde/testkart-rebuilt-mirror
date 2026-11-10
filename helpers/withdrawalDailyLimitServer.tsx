import { Transaction } from "kysely";
import superjson from "superjson";
import { DB } from "./schema";
import {
  istDayStart,
  nextIstDayStart,
  WITHDRAWAL_DAILY_LIMIT_CODE,
  WITHDRAWAL_DAILY_LIMIT_MESSAGE,
} from "./withdrawalDailyLimit";

export class WithdrawalDailyLimitError extends Error {
  constructor(public readonly lastRequestedAt: Date, public readonly nextAvailableAt: Date) {
    super(WITHDRAWAL_DAILY_LIMIT_MESSAGE);
    this.name = "WithdrawalDailyLimitError";
  }
}

type Owner =
  | { table: "teacherWithdrawals"; teacherId: number }
  | { table: "studentWithdrawals"; studentId: number };

/**
 * Throws WithdrawalDailyLimitError when the user already has a request dated
 * today in IST, whatever its status. Call it inside the transaction, after
 * lockWallet for the same user: the lock queues parallel requests, so the
 * second one reads the row the first one committed and is refused here.
 */
export async function assertNoWithdrawalToday(trx: Transaction<DB>, owner: Owner, now: Date = new Date()) {
  const dayStart = istDayStart(now);
  const existing =
    owner.table === "teacherWithdrawals"
      ? await trx
          .selectFrom("teacherWithdrawals")
          .select("requestedDate")
          .where("teacherId", "=", owner.teacherId)
          .where("requestedDate", ">=", dayStart)
          .orderBy("requestedDate", "desc")
          .executeTakeFirst()
      : await trx
          .selectFrom("studentWithdrawals")
          .select("requestedDate")
          .where("studentId", "=", owner.studentId)
          .where("requestedDate", ">=", dayStart)
          .orderBy("requestedDate", "desc")
          .executeTakeFirst();

  if (existing?.requestedDate) {
    throw new WithdrawalDailyLimitError(new Date(existing.requestedDate), nextIstDayStart(now));
  }
}

export function withdrawalDailyLimitResponse(error: WithdrawalDailyLimitError): Response {
  return new Response(
    superjson.stringify({
      error: error.message,
      code: WITHDRAWAL_DAILY_LIMIT_CODE,
      lastRequestedAt: error.lastRequestedAt,
      nextAvailableAt: error.nextAvailableAt,
    }),
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((error.nextAvailableAt.getTime() - Date.now()) / 1000))) } }
  );
}
