import { z } from "zod";
import type { GecPublicPayload } from "../../../helpers/gecModel";
import { gecGet } from "../../../helpers/gecFetch";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

/** The saved draft shaped exactly like the public payload, dated today, for previews. */
export type OutputType = GecPublicPayload;

export const getAdminGecDraft = (init?: RequestInit) => gecGet<OutputType>("admin/govt-exams-calendar/draft", {}, init);