import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type TransactionType = "sale" | "withdrawal" | "sponsored" | "prize_deduction" | "subscription";

export type EarningTransaction = {
  transactionDate: Date | null;
  testTitle: string;
  studentName: string;
  grossAmount: number;
  platformFeePercentage: number;
  amountEarned: number;
  transactionType: TransactionType;
  isLiveTest?: boolean;
  liveTestEnded?: boolean;
};

export type OutputType = EarningTransaction[];

export const getTeacherEarningsList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/earnings/list`, {
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