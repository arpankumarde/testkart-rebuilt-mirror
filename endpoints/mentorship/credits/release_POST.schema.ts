import { z } from "zod";
import superjson from "superjson";

/** Moves a paid class waiting for a time into the live class balance, to use with any teacher. */
export const schema = z.object({ creditId: z.string().uuid() });
export type InputType = z.infer<typeof schema>;
export type OutputType = { released: number };

export const postMentorshipCreditRelease = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/credits/release`, {
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
