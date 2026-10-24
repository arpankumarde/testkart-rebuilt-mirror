import { z } from "zod";
import superjson from "superjson";
import type { SpinViewState } from "../../helpers/spinWinViewer";

export const schema = z.object({
  slug: z.string().trim().min(1).max(120),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  spin: SpinViewState | null;
  /** Set when the guest reward could not be added because the account had already spun. */
  forfeited: boolean;
  message: string | null;
};

export const postSpinWinClaim = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(body);
  const result = await fetch(`/_api/spin-win/claim`, {
    method: "POST",
    body: superjson.stringify(validated),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};