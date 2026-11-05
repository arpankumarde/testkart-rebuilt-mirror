import { z } from "zod";

export const schema = z.object({ create: z.boolean().optional() });
export type InputType = z.infer<typeof schema>;
export type OutputType = { statuses: unknown; results?: unknown };