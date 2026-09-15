import { z } from "zod";
import superjson from 'superjson';

export const schema = z.object({
  mockTestId: z.number().int().positive().optional(),
  digitalProductId: z.number().int().positive().optional(),
  courseId: z.number().int().positive().optional(),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().max(1000, "Review must be 1000 characters or less.").optional(),
}).refine(
  (data) => {
    const definedCount = [data.mockTestId, data.digitalProductId, data.courseId].filter(v => v !== undefined).length;
    return definedCount === 1;
  },
  {
    message: "Exactly one of mockTestId, digitalProductId, or courseId must be provided",
  }
);

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
};

export const postSubmitReview = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/reviews/submit`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const responseJson = superjson.parse(await result.text());

  if (!result.ok) {
    const errorObject = responseJson as { error: string };
    throw new Error(errorObject.error || "Failed to submit review");
  }

  return responseJson as OutputType;
};