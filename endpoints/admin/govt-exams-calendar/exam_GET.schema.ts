import { z } from "zod";
import type { GecExam } from "../../../helpers/gecModel";
import { gecGet } from "../../../helpers/gecFetch";

export const schema = z.object({ id: z.number().int().positive() });

export type InputType = z.infer<typeof schema>;

export type OutputType = { exam: GecExam };

export const getAdminGecExam = (input: InputType, init?: RequestInit) =>
  gecGet<OutputType>("admin/govt-exams-calendar/exam", { id: input.id }, init);