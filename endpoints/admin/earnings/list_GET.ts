import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { sql, RawBuilder, ExpressionBuilder } from "kysely";
import { DB } from "../../../helpers/schema";
import {
  buildTeacherNetEarningsSql,
  buildTeacherSalesCountSql,
  buildTeacherWithdrawalsSql,
  buildTeacherSponsoredDeductionsSql,
  buildTeacherPrizeDeductionsSql,
  buildTeacherSubscriptionWalletPaymentsSql,
  buildTeacherAvailableBalanceSql,
} from "../../../helpers/teacherEarningsSql";

// All the earnings/balance math below is built from helpers/teacherEarningsSql.tsx,
// correlated per-row against `users.id` (the current row in the paginated teacher
// list). This keeps this page's numbers byte-for-byte identical to the teacher-facing
// earnings page and every other admin dashboard — see that file's header comment for
// why this used to drift (it was hand-copied here before).
const teacherIdRef = sql.ref("users.id");

// The shared builders are typed as RawBuilder<{ total: string }> (handy for standalone
// execution elsewhere); re-wrap as a plain string-typed scalar expression for use as a
// single column in this paginated SELECT list.
function asScalar(builder: RawBuilder<{ total: string }>) {
  return sql<string>`${builder}`;
}

function getEarningsSortExpression(sortBy: string) {
  switch (sortBy) {
    case "name":
      return "users.displayName" as const;
    case "email":
      return "users.email" as const;
    case "totalEarnings":
      return asScalar(buildTeacherNetEarningsSql(teacherIdRef));
    case "totalWithdrawals":
      return asScalar(buildTeacherWithdrawalsSql(teacherIdRef, "completed"));
    case "pendingWithdrawals":
      return asScalar(buildTeacherWithdrawalsSql(teacherIdRef, "pending"));
    case "transactionsCount":
      return asScalar(buildTeacherSalesCountSql(teacherIdRef));
    case "totalPrizeDeductions":
      return asScalar(buildTeacherPrizeDeductionsSql(teacherIdRef));
    case "totalSubscriptionWalletPayments":
      return asScalar(buildTeacherSubscriptionWalletPaymentsSql(teacherIdRef));
    case "availableBalance":
      return asScalar(buildTeacherAvailableBalanceSql(teacherIdRef));
    default:
      return "users.createdAt" as const;
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = (url.searchParams.get("sortOrder") || "desc") as "asc" | "desc";

    const baseQuery = db
      .selectFrom("users")
      .where("users.role", "=", "teacher");

    let earningsQuery = baseQuery
      .select([
        "users.id as teacherId",
        "users.displayName as teacherName",
        "users.email as teacherEmail",
        asScalar(buildTeacherNetEarningsSql(teacherIdRef)).as("totalEarnings"),
        asScalar(buildTeacherWithdrawalsSql(teacherIdRef, "completed")).as("totalWithdrawals"),
        asScalar(buildTeacherWithdrawalsSql(teacherIdRef, "pending")).as("pendingWithdrawals"),
        asScalar(buildTeacherSponsoredDeductionsSql(teacherIdRef)).as("totalSponsored"),
        asScalar(buildTeacherPrizeDeductionsSql(teacherIdRef)).as("totalPrizeDeductions"),
        asScalar(buildTeacherSubscriptionWalletPaymentsSql(teacherIdRef)).as("totalSubscriptionWalletPayments"),
        asScalar(buildTeacherSalesCountSql(teacherIdRef)).as("transactionsCount"),
      ])
      .orderBy(getEarningsSortExpression(sortBy), sortOrder)
      .limit(limit)
      .offset(offset);

    let countQuery = baseQuery.select((eb) =>
      eb.fn.countAll<string>().as("count")
    );

    if (search) {
      const searchQuery = `%${search}%`;
      const searchFilter = (eb: ExpressionBuilder<DB, "users">) =>
        eb.or([
          eb("users.displayName", "ilike", searchQuery),
          eb("users.email", "ilike", searchQuery),
        ]);

      earningsQuery = earningsQuery.where(searchFilter);
      countQuery = countQuery.where(searchFilter);
    }

    const [earningsData, totalResult] = await Promise.all([
      earningsQuery.execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    const totalCount = parseInt(totalResult.count, 10);
    const totalPages = Math.ceil(totalCount / limit);

    const output: OutputType = {
      earnings: earningsData.map((e) => {
        const totalEarnings = parseFloat(e.totalEarnings as string);
        const totalWithdrawals = parseFloat(e.totalWithdrawals as string);
        const totalSponsored = parseFloat(e.totalSponsored as string);
        const totalPrizeDeductions = parseFloat(e.totalPrizeDeductions as string);
        const totalSubscriptionWalletPayments = parseFloat(e.totalSubscriptionWalletPayments as string);
        return {
          teacherId: e.teacherId,
          teacherName: e.teacherName,
          teacherEmail: e.teacherEmail,
          totalEarnings,
          totalWithdrawals,
          pendingWithdrawals: parseFloat(e.pendingWithdrawals as string),
          totalSponsored,
          totalPrizeDeductions,
          totalSubscriptionWalletPayments,
          availableBalance: Math.max(0, Math.round((totalEarnings - totalWithdrawals - totalSponsored - totalPrizeDeductions - totalSubscriptionWalletPayments) * 100) / 100),
          transactionsCount: parseInt(e.transactionsCount as string, 10),
        };
      }),
      totalCount,
      currentPage: page,
      totalPages,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching earnings list:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}
