import { z } from "zod";
import { spinAdminFetch } from "../../../helpers/spinWinAdminFetch";

export const schema = z.object({
  id: z.number().int().positive(),
  reason: z.string().trim().min(5, "Give a short reason").max(500),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export const postAdminSpinCouponVoid = (body: InputType, init?: RequestInit) =>
  spinAdminFetch<OutputType>("coupon-void", schema.parse(body), init);