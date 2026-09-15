import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { SubscriptionTransactions } from "../../../helpers/schema";

export const schema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().optional().default(10),
});

export type InputType = z.infer<typeof schema>;

export type TransactionHistoryItem = Omit<
  Selectable<SubscriptionTransactions>,
  "amount"
> & {
  planName: string;
  amount: number;
};

export type OutputType = {
  transactions: TransactionHistoryItem[];
  totalCount: number;
  page: number;
  limit: number;
};

export const getTeacherSubscriptionHistory = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    page: validatedParams.page.toString(),
    limit: validatedParams.limit.toString(),
  });

  const result = await fetch(
    `/_api/teacher/subscription/history?${searchParams.toString()}`,
    {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};