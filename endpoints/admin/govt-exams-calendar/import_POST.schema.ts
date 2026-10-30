import { z } from "zod";
import type { GecIssue } from "../../../helpers/gecExamInput";
import { gecPost } from "../../../helpers/gecFetch";

/** Adds and updates records from a CSV or JSON export. Matches records by slug and dates by id or type, stage and date. Never deletes. */
export const schema = z.object({
  format: z.enum(["csv", "json"]),
  content: z.string().min(1, "The file is empty").max(3_000_000, "The file is too large"),
  dryRun: z.boolean(),
  includePage: z.boolean(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  dryRun: boolean;
  summary: { created: number; updated: number; eventsAdded: number; eventsUpdated: number; skipped: number; pageReplaced: boolean };
  issues: GecIssue[];
};

export const postAdminGecImport = (input: InputType, init?: RequestInit) =>
  gecPost<OutputType>("admin/govt-exams-calendar/import", schema.parse(input), init);