import { z } from "zod";
import { gecGet } from "../../../helpers/gecFetch";

export const schema = z.object({ q: z.string().trim().min(1).max(80) });

export type InputType = z.infer<typeof schema>;

export type OutputType = { exams: { id: number; name: string; slug: string; fullName: string | null }[] };

export const getAdminGecTestkartExams = (input: InputType, init?: RequestInit) =>
  gecGet<OutputType>("admin/govt-exams-calendar/testkart-exams", { q: input.q }, init);