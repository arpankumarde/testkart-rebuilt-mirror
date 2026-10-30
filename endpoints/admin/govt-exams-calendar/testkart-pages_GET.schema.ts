import { z } from "zod";
import { gecGet } from "../../../helpers/gecFetch";

export const schema = z.object({ examId: z.number().int().positive() });

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  exam: { id: number; name: string; slug: string };
  pages: { label: string; href: string }[];
};

export const getAdminGecTestkartPages = (input: InputType, init?: RequestInit) =>
  gecGet<OutputType>("admin/govt-exams-calendar/testkart-pages", { examId: input.examId }, init);