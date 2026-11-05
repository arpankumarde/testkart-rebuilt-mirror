import { z } from "zod";

/** A tracked autopilot link: /_api/go?c=<code>. Opened by people, never called from app code. */
export const schema = z.object({
  c: z.string().regex(/^[0-9A-Za-z]{8}$/),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = never;