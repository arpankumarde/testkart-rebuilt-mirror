import { z } from "zod";
import { gecGet } from "../../../helpers/gecFetch";

export const schema = z.object({ format: z.enum(["csv", "json"]) });

export type InputType = z.infer<typeof schema>;

export type OutputType = { filename: string; contentType: string; body: string };

export const getAdminGecExport = (input: InputType, init?: RequestInit) =>
  gecGet<OutputType>("admin/govt-exams-calendar/export", { format: input.format }, init);