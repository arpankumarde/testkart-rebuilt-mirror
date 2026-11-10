import { z } from "zod";
import superjson from "superjson";
import type { CashfreeCheckoutSession } from "../../../helpers/cashfreeCheckout";

export const schema = z.object({
  groupLessonId: z.string().uuid(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = CashfreeCheckoutSession;

export const postMentorshipGroupLessonPurchase = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/mentorship/group-lessons/purchase`, {
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
