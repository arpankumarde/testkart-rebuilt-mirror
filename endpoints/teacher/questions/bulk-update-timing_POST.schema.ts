import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  subjectId: z.number().int(),
  durationSeconds: z.number().int().min(1),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  updatedCount: number;
};

export const postBulkUpdateTiming = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/questions/bulk-update-timing`, {
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
      throw new Error("Failed to bulk update timing");
    }
  }

  return superjson.parse<OutputType>(await result.text());
};