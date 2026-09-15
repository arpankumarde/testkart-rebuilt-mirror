import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  ids: z.array(z.number()).min(1, "At least one question ID is required."),
  markForReview: z.boolean(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  count: number;
};

export const postAdminBulkMarkReview = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/ai-questions/bulk-mark-review`, {
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