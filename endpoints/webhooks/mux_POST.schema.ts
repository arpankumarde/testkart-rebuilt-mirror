import { z } from "zod";

// Mux webhook body. Only the fields this app reads are listed; the rest pass through.
export const schema = z
  .object({
    type: z.string(),
    id: z.string().optional(),
    data: z
      .object({
        id: z.string(),
        status: z.string().optional(),
        passthrough: z.string().optional(),
        errors: z.object({ type: z.string().optional(), messages: z.array(z.string()).optional() }).optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type InputType = z.infer<typeof schema>;

export type OutputType = { received: true };
