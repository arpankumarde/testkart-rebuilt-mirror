import { z } from "zod";

export const schema = z.object({ token: z.string().min(1).max(100) });

export type InputType = z.infer<typeof schema>;

/** Not fetched: the pay page navigates the browser here, and the response auto-posts to PayU. */
export const payLinkRedirectPath = (token: string) => `/_api/pay-link/redirect?token=${encodeURIComponent(token)}`;
