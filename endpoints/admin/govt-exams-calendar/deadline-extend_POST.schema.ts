import { z } from "zod";
import { gecPost } from "../../../helpers/gecFetch";

export const schema = z.object({
  eventId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the new last date"),
  label: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .transform((value) => value || null),
});

export type InputType = z.input<typeof schema>;

export type OutputType = { success: true };

export const postAdminGecExtendDeadline = (input: InputType, init?: RequestInit) =>
  gecPost<OutputType>("admin/govt-exams-calendar/deadline-extend", input, init);