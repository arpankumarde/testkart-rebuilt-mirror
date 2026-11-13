import { z } from "zod";
import superjson from "superjson";
import type { CashfreeCheckoutSession } from "../../helpers/cashfreeCheckout";

/** Books a trial: the only 1:1 class sold on its own. Later classes come in packages. */
export const schema = z.object({
  teacherId: z.number().int().positive(),
  /** 30 or 60 minutes - see MENTORSHIP_SESSION_DURATIONS. */
  durationMinutes: z.number().int().positive(),
  startTime: z.coerce.date(),
});

export type InputType = z.infer<typeof schema>;

/** "completed" when the live class balance covered it and the class is booked. */
export type OutputType =
  | { kind: "checkout"; session: CashfreeCheckoutSession }
  | { kind: "completed"; orderId: number };

export const postMentorshipPurchase = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/mentorship/purchase`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: string }>(await result.text());
    throw new Error(errorObject.details || errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
