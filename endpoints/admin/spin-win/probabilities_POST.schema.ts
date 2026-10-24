import { z } from "zod";
import { spinAdminFetch } from "../../../helpers/spinWinAdminFetch";

export const schema = z.object({
  campaignId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        id: z.number().int().positive(),
        probability: z.number().min(0).max(100).multipleOf(0.001, "Use at most 3 decimal places"),
        isActive: z.boolean(),
      })
    )
    .min(1),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export const postAdminSpinProbabilities = (body: InputType, init?: RequestInit) =>
  spinAdminFetch<OutputType>("probabilities", schema.parse(body), init);