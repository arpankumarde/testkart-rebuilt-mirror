import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ packageId: z.string().uuid() });
export type InputType = z.infer<typeof schema>;
/** released: what went back to the live class balance. */
export type OutputType = { released: number };

export const postMentorshipPackageCancel = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/packages/cancel`, {
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
