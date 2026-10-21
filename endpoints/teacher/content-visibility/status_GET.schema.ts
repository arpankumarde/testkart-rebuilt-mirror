import { z } from "zod";
import superjson from "superjson";
import type { ContentVisibility } from "../../../helpers/schema";
import type { ContentRejection } from "../../../helpers/contentReviewStatus";
import { REVIEWABLE_CONTENT_TYPES } from "../content-reviews/withdraw_POST.schema";

export const schema = z.object({
  contentType: z.enum(REVIEWABLE_CONTENT_TYPES),
  contentId: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  visibility: ContentVisibility;
  /** Published: open to anyone with the link, and listed too when public. */
  live: boolean;
  /** Waiting for review: a public publish, or a live unlisted item asking to go public. */
  inReview: boolean;
  /** The item's public URL path, e.g. /mock-test/some-slug. */
  publicPath: string | null;
  /** Set when a live unlisted item's latest request to go public was rejected. */
  publicRequestRejection: ContentRejection | null;
};

export const getTeacherContentVisibilityStatus = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(params);
  const query = new URLSearchParams({
    contentType: validatedInput.contentType,
    contentId: String(validatedInput.contentId),
  });
  const result = await fetch(`/_api/teacher/content-visibility/status?${query.toString()}`, {
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