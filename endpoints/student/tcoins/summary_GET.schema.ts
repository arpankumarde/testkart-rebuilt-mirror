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
  /** When this order's cashback batch expires; null when it earned none. */
  tcoinsCashbackExpiresAt: Date | null;
};

export type TcoinGrantEntry = {
  grantId: number;
  createdAt: Date;
  coins: number;
  expiresAt: Date;
};

export type OutputType = {
  /** False while Tcoins are switched off; every other field is then zero or empty. */
  enabled: boolean;
  redeemPercent: number;
  maxRedeem: number;
  cashbackPercent: number;
  maxCashback: number;
  expiryDays: number;
  balance: number;
  pendingCashback: number;
  totalEarned: number;
  totalSpent: number;
  totalExpired: number;
  /** Unspent batches still to expire, soonest first. */
  expiring: { coins: number; expiresAt: Date }[];
  history: TcoinHistoryEntry[];
  /** Coins given by Testkart (offers, goodwill), newest first. Kept apart from history, which the app reads as orders. */
  grants: TcoinGrantEntry[];
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