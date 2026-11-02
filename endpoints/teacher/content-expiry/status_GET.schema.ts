import { z } from "zod";
import superjson from "superjson";
import type { ContentExpiryStatus } from "../../../helpers/contentExpiryServer";
import { REVIEWABLE_CONTENT_TYPES } from "../content-reviews/withdraw_POST.schema";

export const schema = z.object({
  contentType: z.enum(REVIEWABLE_CONTENT_TYPES),
  contentId: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = ContentExpiryStatus;

export const getTeacherContentExpiryStatus = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(params);
  const query = new URLSearchParams({
    contentType: validatedInput.contentType,
    contentId: String(validatedInput.contentId),
  });
  const result = await fetch(`/_api/teacher/content-expiry/status?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
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