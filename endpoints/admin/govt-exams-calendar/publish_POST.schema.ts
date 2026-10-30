import { z } from "zod";
import type { GecAdminMeta } from "../../../helpers/gecServer";
import { gecPost } from "../../../helpers/gecFetch";

export const schema = z.object({
  summary: z.string().max(1000),
  addToPublicLog: z.boolean(),
  publicText: z.string().max(600),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = GecAdminMeta;

export const postAdminGecPublish = (input: InputType, init?: RequestInit) =>
  gecPost<OutputType>("admin/govt-exams-calendar/publish", schema.parse(input), init);