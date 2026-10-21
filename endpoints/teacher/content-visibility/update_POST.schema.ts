import { z } from "zod";
import superjson from "superjson";
import { ContentVisibilityArrayValues } from "../../../helpers/schema";
import { REVIEWABLE_CONTENT_TYPES } from "../content-reviews/withdraw_POST.schema";

export const schema = z.object({
  contentType: z.enum(REVIEWABLE_CONTENT_TYPES),
  /** The item's own id; for a live test this is liveTests.id, not its mock test id. */
  contentId: z.number().int().positive(),
  visibility: z.enum(ContentVisibilityArrayValues),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  /** The visibility now stored. A live item asking to go public stays unlisted until approved. */
  visibility: InputType["visibility"];
  inReview: boolean;
  message: string;
};

export const postTeacherContentVisibilityUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/content-visibility/update`, {
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