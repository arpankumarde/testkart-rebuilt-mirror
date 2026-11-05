import { z } from "zod";

/** Resend webhook events (Svix-signed). Called by Resend only, never by app code. */
export const schema = z.object({
  type: z.string(),
  created_at: z.string().optional(),
  data: z
    .object({
      email_id: z.string().optional(),
      to: z.union([z.array(z.string()), z.string()]).optional(),
      tags: z.unknown().optional(),
    })
    .passthrough(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { ok: true } | { error: string };