import { z } from "zod";
import superjson from "superjson";
import type { SpinViewState } from "../../helpers/spinWinViewer";

export const schema = z.object({
  slug: z.string().trim().min(1).max(120),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  spin: SpinViewState;
  /** True when this request returned an earlier spin instead of making a new one. */
  alreadySpun: boolean;
  message: string | null;
};

export const postSpinWinSpin = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(body);
  const result = await fetch(`/_api/spin-win/spin`, {
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