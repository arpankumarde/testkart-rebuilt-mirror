import { z } from "zod";
import { gecPost } from "../../../helpers/gecFetch";

export const schema = z.object({ id: z.number().int().positive(), hidden: z.boolean() });

export type InputType = z.infer<typeof schema>;

export type OutputType = { success: true };

export const postAdminGecVisibility = (input: InputType, init?: RequestInit) =>
  gecPost<OutputType>("admin/govt-exams-calendar/exam-visibility", schema.parse(input), init);