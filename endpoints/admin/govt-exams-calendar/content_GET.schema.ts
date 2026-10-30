import { z } from "zod";
import type { GecPageContent } from "../../../helpers/gecModel";
import { gecGet } from "../../../helpers/gecFetch";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = { page: GecPageContent; draftUpdatedAt: string; draftUpdatedBy: string | null };

export const getAdminGecContent = (init?: RequestInit) => gecGet<OutputType>("admin/govt-exams-calendar/content", {}, init);