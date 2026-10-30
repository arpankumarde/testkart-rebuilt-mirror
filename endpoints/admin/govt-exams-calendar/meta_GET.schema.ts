import { z } from "zod";
import type { GecAdminMeta } from "../../../helpers/gecServer";
import { gecGet } from "../../../helpers/gecFetch";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = GecAdminMeta & { pendingSummary: { section: string; summary: string }[] };

export const getAdminGecMeta = (init?: RequestInit) => gecGet<OutputType>("admin/govt-exams-calendar/meta", {}, init);