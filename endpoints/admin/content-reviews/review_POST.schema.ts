import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  reviewId: z.number().int().positive(),
  action: z.enum(["approve", "reject"]),
  adminNotes: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  message: string;
};

export const postReviewContent = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);

  const result = await fetch(`/_api/admin/content-reviews/review`, {
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