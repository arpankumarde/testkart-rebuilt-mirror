import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  groupLessonId: z.number().int().positive(),
  studentId: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export const postTeacherGroupLessonRemoveParticipant = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/group-lessons/remove-participant`, {
    method: "POST",
    body: superjson.stringify(input),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
