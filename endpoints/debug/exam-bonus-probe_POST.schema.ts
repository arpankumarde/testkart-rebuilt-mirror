import { z } from "zod";

export const schema = z.object({ part: z.enum(["flow", "race"]) });

export type InputType = z.infer<typeof schema>;

export type OutputType = { lines: string[]; pass: number; fail: number };
