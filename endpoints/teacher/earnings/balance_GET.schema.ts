import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type BalanceBreakdownItem = {
  count: number;
  amount: number;
};

export type OutputType = {
  totalEarned: number;
  totalWithdrawn: number;
  totalSponsored: number;
  totalPrizeDeductions: number;
  totalSubscriptionWalletPayments: number;
  availableBalance: number;
  breakdown: {
    sales: BalanceBreakdownItem;
    withdrawals: BalanceBreakdownItem;
    sponsored: BalanceBreakdownItem;
    subscriptionPayments: BalanceBreakdownItem;
    prizes: BalanceBreakdownItem;
  };
};

export const getTeacherBalance = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/earnings/balance`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};