import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ liveCourseId: z.string().uuid() });
export type InputType = z.infer<typeof schema>;
export type OutputType = { amount: number; refundStatus: string };

export const postLiveCourseRefund = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/live-courses/refund`, {
    method: "POST",
    body: superjson.stringify(schema.parse(input)),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
