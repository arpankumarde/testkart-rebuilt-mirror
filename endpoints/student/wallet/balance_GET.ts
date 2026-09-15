import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./balance_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { getStudentAvailableBalance } from "../../../helpers/getStudentAvailableBalance";
import { db } from "../../../helpers/db";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    // Credits
    const creditsResult = await db
      .selectFrom("studentWalletTransactions")
      .where("studentId", "=", user.id)
      .where("transactionType", "in", ["prize_credit", "prize_lock_refund"])
      .select([
        sql<string>`count(*)`.as("count"),
        sql<string>`sum(amount)`.as("totalAmount"),
      ])
      .executeTakeFirst();

    const creditsCount = Number(creditsResult?.count || 0);
    const totalCredits = Number(creditsResult?.totalAmount || 0);

    // Withdrawals (Completed + Pending to calculate available balance correctly)
    const withdrawalsResult = await db
      .selectFrom("studentWithdrawals")
      .where("studentId", "=", user.id)
      .where("status", "in", ["completed", "pending"])
      .select([
        sql<string>`count(*)`.as("count"),
        sql<string>`sum(amount)`.as("totalAmount"),
      ])
      .executeTakeFirst();

    const withdrawalsCount = Number(withdrawalsResult?.count || 0);
    const totalWithdrawn = Number(withdrawalsResult?.totalAmount || 0);

    // Purchase debits
    const purchasesResult = await db
      .selectFrom("studentWalletTransactions")
      .where("studentId", "=", user.id)
      .where("transactionType", "=", "purchase_debit")
      .select([
        sql<string>`count(*)`.as("count"),
        sql<string>`sum(amount)`.as("totalAmount"),
      ])
      .executeTakeFirst();

    const purchasesCount = Number(purchasesResult?.count || 0);
    const totalPurchased = Number(purchasesResult?.totalAmount || 0);

    const availableBalance = Math.max(0, totalCredits - totalWithdrawn - totalPurchased);

    const output: OutputType = {
      availableBalance,
      totalCredits,
      totalWithdrawn,
      totalPurchased,
      breakdown: {
        credits: { count: creditsCount, amount: totalCredits },
        withdrawals: { count: withdrawalsCount, amount: totalWithdrawn },
        purchases: { count: purchasesCount, amount: totalPurchased },
      },
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error calculating student wallet balance:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    return new Response(superjson.stringify({ error: "Unknown error" }), {
      status: 500,
    });
  }
}