import { z } from "zod";
import superjson from "superjson";
import { PREVIEW_CONTENT_TYPES } from "./details_GET.schema";

export const CONTENT_STATUS_ACTIONS = ["publish", "unpublish", "reject"] as const;
export type ContentStatusAction = (typeof CONTENT_STATUS_ACTIONS)[number];

export const schema = z.object({
  type: z.enum(PREVIEW_CONTENT_TYPES),
  id: z.number().int().positive(),
  action: z.enum(CONTENT_STATUS_ACTIONS),
  note: z.string().max(2000).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { message: string };

export const postAdminContentStatus = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(body);
  const result = await fetch(`/_api/admin/content-preview/status`, {
    method: "POST",
    body: superjson.stringify(validated),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};