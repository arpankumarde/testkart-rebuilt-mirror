import { z } from "zod";

/** Cashfree posts plain JSON, not superjson, and the handler reads the raw body to check its signature. */
export const schema = z.object({
  type: z.string(),
  data: z
    .object({
      order: z.object({ order_id: z.string() }).passthrough(),
    })
    .passthrough(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { received: true };
