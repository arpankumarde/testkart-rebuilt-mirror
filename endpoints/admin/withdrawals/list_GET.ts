import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./list_GET.schema";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    const url = new URL(request.url);
    const queryParams = {
      page: Number(url.searchParams.get("page") || "1"),
      limit: Number(url.searchParams.get("limit") || "20"),
      status: url.searchParams.get("status") || undefined,
      search: url.searchParams.get("search") || undefined,
    };

    const input = schema.parse(queryParams);
    const offset = (input.page - 1) * input.limit;

    let query = db
      .selectFrom("teacherWithdrawals")
      .innerJoin("users", "teacherWithdrawals.teacherId", "users.id")
      .leftJoin("teacherBankDetails", "teacherBankDetails.teacherId", "users.id")
      .select([
        "teacherWithdrawals.id",
        "teacherWithdrawals.amount",
        "teacherWithdrawals.status",
        "teacherWithdrawals.requestedDate",
        "teacherWithdrawals.processedDate",
        "teacherWithdrawals.transactionId",
        "teacherWithdrawals.notes",
        "teacherWithdrawals.teacherId",
        "users.displayName as teacherName",
        "users.email as teacherEmail",
        "teacherBankDetails.verificationStatus as bankVerificationStatus",
        "teacherBankDetails.bankName as bankName",
        "teacherBankDetails.bankAccountHolderName as bankAccountHolderName",
        "teacherBankDetails.bankAccountNumber as bankAccountNumber",
        "teacherBankDetails.bankIfscCode as bankIfscCode",
        "teacherBankDetails.upiId as bankUpiId",
      ]);

    if (input.status) {
      query = query.where("teacherWithdrawals.status", "=", input.status);
    }

    if (input.search) {
      const searchLower = `%${input.search.toLowerCase()}%`;
      query = query.where((eb) =>
        eb.or([
          eb(sql`lower(users.display_name)`, "like", searchLower),
          eb(sql`lower(users.email)`, "like", searchLower),
        ])
      );
    }

    // Get total count for pagination
    const countResult = await query
      .clearSelect()
      .select(sql<string>`count(*)`.as("count"))
      .executeTakeFirst();
    
    const totalCount = Number(countResult?.count || 0);
    const totalPages = Math.ceil(totalCount / input.limit);

    // Get paginated results
    const withdrawals = await query
      .orderBy("teacherWithdrawals.requestedDate", "desc")
      .limit(input.limit)
      .offset(offset)
      .execute();

    // Batch-compute balances for unique teachers on this page
    const uniqueTeacherIds = [...new Set(withdrawals.map((w) => w.teacherId))];
    console.log(
      `Computing wallet balances for ${uniqueTeacherIds.length} unique teacher(s) on this page`
    );
    const balanceResults = await Promise.all(
      uniqueTeacherIds.map(async (teacherId) => {
        const balance = await getTeacherAvailableBalance(teacherId);
        return { teacherId, availableBalance: balance.availableBalance };
      })
    );
    const teacherBalanceMap = new Map(
      balanceResults.map((r) => [r.teacherId, r.availableBalance])
    );

    const output: OutputType = {
      withdrawals: withdrawals.map((w) => ({
        ...w,
        amount: Number(w.amount),
        currentWalletBalance: teacherBalanceMap.get(w.teacherId) ?? 0,
      })),
      totalCount,
      totalPages,
      currentPage: input.page,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching admin withdrawals:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}