import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  mockTestId: z.number().int().positive().optional(),
  courseId: z.number().int().positive().optional(),
  digitalProductId: z.number().int().positive().optional(),
}).refine(
  (data) => {
    const providedFields = [
      data.mockTestId,
      data.courseId,
      data.digitalProductId,
    ].filter(Boolean);
    return providedFields.length === 1;
  },
  {
    message: "Exactly one of mockTestId, courseId, or digitalProductId must be provided",
  }
);

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  message: string;
};

export const postCartAdd = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/cart/add`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};