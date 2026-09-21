import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./list_GET.schema";
import { getStudentsAvailableBalances } from "../../../helpers/getStudentAvailableBalance";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const queryParams = {
      page: Number(url.searchParams.get("page") || "1"),
      limit: Number(url.searchParams.get("limit") || "20"),
      status: url.searchParams.get("status") || undefined,
      search: url.searchParams.get("search") || undefined,
      sortBy: url.searchParams.get("sortBy") || undefined,
      sortOrder: url.searchParams.get("sortOrder") || undefined,
    };

    const input = schema.parse(queryParams);
    const offset = (input.page - 1) * input.limit;

    let query = db
      .selectFrom("studentWithdrawals")
      .innerJoin("users", "studentWithdrawals.studentId", "users.id")
      .leftJoin("studentBankDetails", "studentBankDetails.studentId", "users.id")
      .select([
        "studentWithdrawals.id",
        "studentWithdrawals.amount",
        "studentWithdrawals.status",
        "studentWithdrawals.requestedDate",
        "studentWithdrawals.processedDate",
        "studentWithdrawals.transactionId",
        "studentWithdrawals.notes",
        "studentWithdrawals.studentId",
        "users.displayName as studentName",
        "users.email as studentEmail",
        "users.mobileNumber as studentMobile",
        "studentBankDetails.verificationStatus as bankVerificationStatus",
        "studentBankDetails.bankName as bankName",
        "studentBankDetails.bankAccountHolderName as bankAccountHolderName",
        "studentBankDetails.bankAccountNumber as bankAccountNumber",
        "studentBankDetails.bankIfscCode as bankIfscCode",
        "studentBankDetails.upiId as bankUpiId",
      ]);

    if (input.status) {
      query = query.where("studentWithdrawals.status", "=", input.status);
    }

    if (input.search) {
      const searchLower = `%${input.search.toLowerCase()}%`;
      query = query.where((eb) =>
        eb.or([
          eb(sql`lower(users.display_name)`, "like", searchLower),
          eb(sql`lower(users.email)`, "like", searchLower),
          eb(sql`lower(users.mobile_number)`, "like", searchLower),
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

    // Get paginated results, newest first unless a column sort was asked for
    const direction = input.sortOrder === "desc" ? sql`desc nulls last` : sql`asc nulls last`;
    let ordered = query;
    if (input.sortBy === "name") {
      ordered = ordered.orderBy(sql`lower(${sql.ref("users.displayName")})`, direction);
    } else if (input.sortBy === "amount") {
      ordered = ordered.orderBy("studentWithdrawals.amount", direction);
    } else if (input.sortBy === "status") {
      ordered = ordered.orderBy(sql`${sql.ref("studentWithdrawals.status")}::text`, direction);
    }

    const withdrawals = await ordered
      .orderBy("studentWithdrawals.createdAt", "desc")
      .orderBy("studentWithdrawals.id", "desc")
      .limit(input.limit)
      .offset(offset)
      .execute();

    // Batch-compute balances for unique students on this page (2 queries regardless of page size)
    const uniqueStudentIds = [...new Set(withdrawals.map((w) => w.studentId))];
    console.log(
      `Computing wallet balances for ${uniqueStudentIds.length} unique student(s) on this page`
    );
    const studentBalanceMap = await getStudentsAvailableBalances(uniqueStudentIds);

    const output: OutputType = {
      withdrawals: withdrawals.map((w) => ({
        ...w,
        amount: Number(w.amount),
        currentWalletBalance: studentBalanceMap.get(w.studentId) ?? 0,
      })),
      totalCount,
      totalPages,
      currentPage: input.page,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching admin student withdrawals:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}