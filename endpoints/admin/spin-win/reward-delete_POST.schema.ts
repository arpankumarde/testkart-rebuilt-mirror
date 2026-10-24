import { z } from "zod";
import { spinAdminFetch } from "../../../helpers/spinWinAdminFetch";

export const schema = z.object({ id: z.number().int().positive() });

export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export const postAdminSpinRewardDelete = (body: InputType, init?: RequestInit) =>
  spinAdminFetch<OutputType>("reward-delete", schema.parse(body), init);