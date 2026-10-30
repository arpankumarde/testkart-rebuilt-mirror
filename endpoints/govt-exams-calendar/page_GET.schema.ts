import { z } from "zod";
import type { GecPublicPayload } from "../../helpers/gecModel";
import { gecGet } from "../../helpers/gecFetch";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

/** The latest published calendar. Drafts are never served here. */
export type OutputType = GecPublicPayload;

export const getGovtExamsCalendarPage = (init?: RequestInit) => gecGet<OutputType>("govt-exams-calendar/page", {}, init);