import { z } from "zod";

/** Waplify webhook events (waplify-BE app/modules/webhooks). Called by Waplify only, never by app code. */
export const schema = z
  .object({
    event: z.string(),
    timestamp: z.string().optional(),
    message: z.unknown().optional(),
    original_message: z.unknown().optional(),
    reply: z.unknown().optional(),
  })
  .passthrough();

export type InputType = z.infer<typeof schema>;

export type OutputType = { ok: true } | { error: string };