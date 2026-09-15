import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { StudentWalletTransactions, WithdrawalStatus } from "../../../helpers/schema";

export const schema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type InputType = z.infer<typeof schema>;

export type WalletTransaction = Omit<Selectable<StudentWalletTransactions>, "amount"> & {
  amount: number;
  // Present only for withdrawal-sourced records
  withdrawalStatus?: WithdrawalStatus;
};

export type OutputType = {
  transactions: WalletTransaction[];
  total: number;
  page: number;
  limit: number;
};

export const getStudentWalletTransactions = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams({
    page: query.page.toString(),
    limit: query.limit.toString(),
  });
  const result = await fetch(`/_api/student/wallet/transactions?${params.toString()}`, {
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