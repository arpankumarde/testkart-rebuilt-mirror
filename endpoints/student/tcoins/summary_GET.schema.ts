import { z } from "zod";
import superjson from "superjson";
import type { OrderStatus } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type TcoinHistoryEntry = {
  orderId: number;
  createdAt: Date;
  status: OrderStatus;
  title: string;
  amountPaid: number;
  tcoinsRedeemed: number;
  tcoinsCashback: number;
};

export type OutputType = {
  /** False while Tcoins are switched off; every other field is then zero or empty. */
  enabled: boolean;
  redeemPercent: number;
  cashbackPercent: number;
  maxCashback: number;
  balance: number;
  pendingCashback: number;
  totalEarned: number;
  totalSpent: number;
  history: TcoinHistoryEntry[];
};

export const getStudentTcoinsSummary = async (
  params: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/student/tcoins/summary`, {
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