import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  classId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export type InputType = z.infer<typeof schema>;
/** Classes of a draft course are deleted; classes of a published course are cancelled and students told. */
export type OutputType = { result: "deleted" | "cancelled" };

export const postTeacherLiveCourseClassCancel = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/live-courses/classes/cancel`, {
    method: "POST",
    body: superjson.stringify(schema.parse(input)),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
