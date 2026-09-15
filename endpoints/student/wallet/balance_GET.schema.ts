import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type BalanceBreakdownItem = {
  count: number;
  amount: number;
};

export type OutputType = {
  availableBalance: number;
  totalCredits: number;
  totalWithdrawn: number;
  totalPurchased: number;
  breakdown: {
    credits: BalanceBreakdownItem;
    withdrawals: BalanceBreakdownItem;
    purchases: BalanceBreakdownItem;
  };
};

export const getStudentWalletBalance = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/student/wallet/balance`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};