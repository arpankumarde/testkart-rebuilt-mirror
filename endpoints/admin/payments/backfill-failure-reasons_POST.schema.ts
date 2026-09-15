import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  // "orders": failed and cancelled PayU orders; "subscriptions": failed PayU subscription payments.
  source: z.enum(["orders", "subscriptions"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  beforeId: z.number().int().positive().optional(),
  dryRun: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

export type BackfillSource = NonNullable<InputType["source"]>;

export type BackfillFailureReasonResult = {
  id: number;
  status: string;
  outcome: "updated" | "not_found" | "lookup_error";
  paymentErrorCode: string | null;
  paymentErrorMessage: string | null;
  paymentBankMessage: string | null;
  paymentGatewayStatus: string | null;
};

export type OutputType = {
  source: BackfillSource;
  dryRun: boolean;
  processed: number;
  updated: number;
  notFound: number;
  lookupErrors: number;
  // Pass back as beforeId to continue; null once nothing older is left.
  nextBeforeId: number | null;
  remaining: number;
  results: BackfillFailureReasonResult[];
};

export const postBackfillFailureReasons = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/payments/backfill-failure-reasons`, {
    method: "POST",
    body: superjson.stringify(body),
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