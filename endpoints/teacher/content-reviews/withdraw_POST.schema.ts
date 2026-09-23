import { z } from "zod";
import superjson from "superjson";

export const REVIEWABLE_CONTENT_TYPES = ["mock_test", "course", "digital_product", "course_bundle", "live_test"] as const;

export const schema = z.object({
  contentType: z.enum(REVIEWABLE_CONTENT_TYPES),
  contentId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
};

export const postTeacherContentReviewsWithdraw = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/content-reviews/withdraw`, {
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