import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ kind: z.enum(["booking", "group"]), lessonId: z.string().uuid() });
export type InputType = z.infer<typeof schema>;

export type TeacherNoteRow = { id: string; studentId: number | null; note: string; createdAt: Date; updatedAt: Date };
export type OutputType = { notes: TeacherNoteRow[] };

export const getTeacherMentorshipNotes = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ kind: input.kind, lessonId: String(input.lessonId) });
  const result = await fetch(`/_api/teacher/mentorship/notes/list?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
