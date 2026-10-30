import { z } from "zod";
import { GEC_BLOCK_KEYS, gecPageSchema, type GecBlockKey, type GecPageContent } from "../../../helpers/gecModel";
import type { OutputType as ContentOutput } from "./content_GET.schema";
import { gecPost } from "../../../helpers/gecFetch";

/** Saves one block of the page draft. Only the parts `block` owns are taken from `page`. */
export const schema = z.object({ block: z.enum(GEC_BLOCK_KEYS), page: gecPageSchema });

export type InputType = { block: GecBlockKey; page: GecPageContent };

export type OutputType = ContentOutput;

export const postAdminGecContentSave = (input: InputType, init?: RequestInit) =>
  gecPost<OutputType>("admin/govt-exams-calendar/content-save", input, init);