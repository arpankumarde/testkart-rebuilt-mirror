import { z } from "zod";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true; settings: { enabled: boolean; shadow: boolean } };