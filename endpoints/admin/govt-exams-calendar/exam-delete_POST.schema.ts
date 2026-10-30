import { z } from "zod";
import { gecPost } from "../../../helpers/gecFetch";

export const schema = z.object({ id: z.number().int().positive() });

export type InputType = z.infer<typeof schema>;

export type OutputType = { success: true };

export const postAdminGecExamDelete = (input: InputType, init?: RequestInit) =>
  gecPost<OutputType>("admin/govt-exams-calendar/exam-delete", schema.parse(input), init);