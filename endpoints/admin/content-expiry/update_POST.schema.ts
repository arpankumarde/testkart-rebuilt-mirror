import { z } from "zod";
import superjson from "superjson";
import type { ContentExpiryStatus } from "../../../helpers/contentExpiryServer";
import { expiryDaySchema } from "../../../helpers/contentExpiry";
import { REVIEWABLE_CONTENT_TYPES } from "../../teacher/content-reviews/withdraw_POST.schema";

export const schema = z.object({
  contentType: z.enum(REVIEWABLE_CONTENT_TYPES),
  contentId: z.number().int().positive(),
  /** Last day on sale (YYYY-MM-DD, IST); null removes the expiry. */
  expiryDay: expiryDaySchema.nullable(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = ContentExpiryStatus;

export const postAdminContentExpiryUpdate = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/content-expiry/update`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};