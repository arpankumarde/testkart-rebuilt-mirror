import { z } from "zod";

/* Requested by daily-js itself (helpers/dailyEngine.tsx), not by app code, so there is no client helper. */
export const schema = z.object({
  v: z.string(),
  f: z.string(),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = string;