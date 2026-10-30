import { z } from "zod";
import { gecPost } from "../../../helpers/gecFetch";

export const schema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  verification: z.enum(["unverified", "verified", "needs_update"]),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { success: true };

export const postAdminGecVerify = (input: InputType, init?: RequestInit) =>
  gecPost<OutputType>("admin/govt-exams-calendar/exam-verify", schema.parse(input), init);