import { z } from "zod";
import { gecPost } from "../../../helpers/gecFetch";

export const schema = z.object({
  summary: z.string().trim().min(1, "Write the note").max(600),
  section: z.string().trim().min(1).max(120),
  isPublic: z.boolean(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { success: true };

export const postAdminGecLogAdd = (input: InputType, init?: RequestInit) =>
  gecPost<OutputType>("admin/govt-exams-calendar/log-add", schema.parse(input), init);