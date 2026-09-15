import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType, WalletTransaction } from "./transactions_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    const url = new URL(request.url);
    const queryParams = {
      page: Number(url.searchParams.get("page") || 1),
      limit: Number(url.searchParams.get("limit") || 20),
    };
    const input = schema.parse(queryParams);

    const offset = (input.page - 1) * input.limit;

    // Fetch all wallet transactions (no pagination yet - we need to merge first)
    const [allWalletTx, allWithdrawals, walletTxCount, withdrawalCount] = await Promise.all([
      db
        .selectFrom("studentWalletTransactions")
        .where("studentId", "=", user.id)
        .selectAll()
        .execute(),
      db
        .selectFrom("studentWithdrawals")
        .where("studentId", "=", user.id)
        .selectAll()
        .execute(),
      db
        .selectFrom("studentWalletTransactions")
        .where("studentId", "=", user.id)
        .select([sql<string>`count(*)`.as("count")])
        .executeTakeFirst(),
      db
        .selectFrom("studentWithdrawals")
        .where("studentId", "=", user.id)
        .select([sql<string>`count(*)`.as("count")])
        .executeTakeFirst(),
    ]);

    // Map wallet transactions to the unified type
    const mappedWalletTx: WalletTransaction[] = allWalletTx.map((t) => ({
      ...t,
      amount: Number(t.amount),
    }));

    // Map withdrawal records to look like wallet transactions
    const mappedWithdrawals: WalletTransaction[] = allWithdrawals.map((w) => {
      const statusLabel =
        w.status.charAt(0).toUpperCase() + w.status.slice(1);
      return {
        id: w.id,
        studentId: w.studentId,
        transactionType: "withdrawal_debit",
        amount: Number(w.amount),
        description: `Withdrawal - ${statusLabel}`,
        referenceId: w.id,
        createdAt: w.requestedDate ?? w.createdAt ?? new Date(),
        withdrawalStatus: w.status,
      };
    });

    // Merge and sort by date descending
    const merged = [...mappedWalletTx, ...mappedWithdrawals].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    const total = Number(walletTxCount?.count || 0) + Number(withdrawalCount?.count || 0);

    // Apply pagination on the merged result
    const paginated = merged.slice(offset, offset + input.limit);

    const output: OutputType = {
      transactions: paginated,
      total,
      page: input.page,
      limit: input.limit,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching student wallet transactions:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400 }
    );
  }
}