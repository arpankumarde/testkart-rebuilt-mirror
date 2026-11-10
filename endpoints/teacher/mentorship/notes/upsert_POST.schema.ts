import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["booking", "group"]),
  lessonId: z.string().uuid(),
  studentId: z.number().int().positive().optional(),
  note: z.string().trim().min(1).max(5000),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { id: string };

export const postTeacherMentorshipNoteUpsert = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/mentorship/notes/upsert`, {
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
