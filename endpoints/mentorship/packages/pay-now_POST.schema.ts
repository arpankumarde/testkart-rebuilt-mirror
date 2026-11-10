import { z } from "zod";
import superjson from "superjson";
import type { CashfreeCheckoutSession } from "../../../helpers/cashfreeCheckout";

/** Pays a renewal whose autopay debit failed, as a one-time payment, during the grace period. */
export const schema = z.object({ packageId: z.string().uuid() });
export type InputType = z.infer<typeof schema>;
export type OutputType = { kind: "checkout"; session: CashfreeCheckoutSession } | { kind: "completed" };

export const postMentorshipPackagePayNow = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/packages/pay-now`, {
    method: "POST",
    body: superjson.stringify(schema.parse(body)),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
