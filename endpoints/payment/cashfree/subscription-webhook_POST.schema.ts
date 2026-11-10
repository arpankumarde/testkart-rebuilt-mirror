import { z } from "zod";

/**
 * Cashfree subscription events (webhook version 2026-01-01), plain JSON. Payment and auth events
 * carry subscription_id and payment_id at the top of data; status changes carry them under
 * data.subscription_details.
 */
export const schema = z.object({
  type: z.string(),
  data: z
    .object({
      subscription_id: z.string().optional(),
      payment_id: z.string().optional(),
      payment_type: z.string().optional(),
      subscription_details: z
        .object({
          subscription_id: z.string().optional(),
          subscription_status: z.string().optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { received: true };
