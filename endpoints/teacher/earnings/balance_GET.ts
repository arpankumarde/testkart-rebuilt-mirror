import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./balance_GET.schema";
import superjson from "superjson";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const balance = await getTeacherAvailableBalance(effectiveTeacherId);

    const output: OutputType = {
      totalEarned: balance.totalEarned,
      totalWithdrawn: balance.totalWithdrawn,
      totalSponsored: balance.totalSponsored,
      totalPrizeDeductions: balance.totalPrizeDeductions,
      totalSubscriptionWalletPayments: balance.totalSubscriptionWalletPayments,
      availableBalance: balance.availableBalance,
      breakdown: {
        sales: balance.breakdown.sales,
        withdrawals: balance.breakdown.withdrawals,
        sponsored: balance.breakdown.sponsored,
        subscriptionPayments: balance.breakdown.subscriptionPayments,
        prizes: balance.breakdown.prizes,
      },
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error calculating teacher balance:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}