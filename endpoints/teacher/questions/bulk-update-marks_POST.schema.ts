import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  subjectId: z.number().int(),
  positiveMarks: z.number().min(0),
  negativeMarks: z.number().min(0),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  updatedCount: number;
};

export const postBulkUpdateMarks = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/questions/bulk-update-marks`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const text = await result.text();
    try {
      const errorObject = superjson.parse<{ error: string }>(text);
      throw new Error(errorObject.error);
    } catch {
      throw new Error("Failed to bulk update marks");
    }
  }

  return superjson.parse<OutputType>(await result.text());
};