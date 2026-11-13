import { z } from "zod";
import superjson from "superjson";
import type { CashfreeCheckoutSession } from "../../helpers/cashfreeCheckout";

export const schema = z.object({ liveCourseId: z.string().uuid() });
export type InputType = z.infer<typeof schema>;
export type OutputType = CashfreeCheckoutSession;

export const postLiveCoursePurchase = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/live-courses/purchase`, {
    method: "POST",
    body: superjson.stringify(schema.parse(input)),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: string }>(await result.text());
    throw new Error(errorObject.details || errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
