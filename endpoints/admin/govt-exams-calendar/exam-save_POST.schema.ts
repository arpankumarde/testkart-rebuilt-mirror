import type { z } from "zod";
import type { GecExam } from "../../../helpers/gecModel";
import { gecExamInputSchema, type GecExamInput } from "../../../helpers/gecExamInput";
import { gecPost } from "../../../helpers/gecFetch";

/** Saves a record and its whole list of dates. Dates missing from `events` are deleted. */
export const schema = gecExamInputSchema;

export type InputType = z.input<typeof schema>;

export type OutputType = { exam: GecExam };

export const postAdminGecExamSave = (input: GecExamInput, init?: RequestInit) =>
  gecPost<OutputType>("admin/govt-exams-calendar/exam-save", input, init);