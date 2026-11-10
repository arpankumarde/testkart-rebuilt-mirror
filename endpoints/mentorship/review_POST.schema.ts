import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  kind: z.enum(["booking", "group"]),
  id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().trim().max(2000).optional(),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export const postMentorshipReview = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/review`, {
    method: "POST",
    body: superjson.stringify(input),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
