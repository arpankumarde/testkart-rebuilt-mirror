import { z } from "zod";

export const schema = z.object({
  kind: z.enum(["order", "subscription"]),
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{10,600}$/),
  mode: z.enum(["sandbox", "production"]),
});

export type InputType = z.infer<typeof schema>;

// Returns an HTML page, not JSON. Browsers reach it through a form post from helpers/cashfreeCheckout.
export type OutputType = void;
