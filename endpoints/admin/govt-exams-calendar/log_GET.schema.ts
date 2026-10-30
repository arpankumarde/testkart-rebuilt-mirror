import { z } from "zod";
import { gecGet } from "../../../helpers/gecFetch";

export const schema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(5).max(100).default(20),
});

export type InputType = z.input<typeof schema>;

export type GecLogEntry = {
  id: number;
  kind: "auto" | "manual" | "publish";
  section: string;
  summary: string;
  isPublic: boolean;
  publicationId: number | null;
  createdAt: string;
  logDate: string;
  adminName: string | null;
};

export type OutputType = { rows: GecLogEntry[]; total: number; totalPages: number };

export const getAdminGecLog = (input: InputType, init?: RequestInit) =>
  gecGet<OutputType>("admin/govt-exams-calendar/log", { page: input.page, limit: input.limit }, init);