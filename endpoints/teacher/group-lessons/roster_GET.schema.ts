import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ groupLessonId: z.coerce.number().int().positive() });
export type InputType = z.infer<typeof schema>;

export type RosterRow = {
  enrollmentId: number;
  studentId: number;
  studentName: string;
  studentAvatarUrl: string | null;
  studentEmail: string | null;
  status: string;
  amountPaid: number;
  enrolledAt: Date;
};

export type OutputType = { roster: RosterRow[] };

export const getTeacherGroupLessonRoster = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ groupLessonId: String(input.groupLessonId) });
  const result = await fetch(`/_api/teacher/group-lessons/roster?${params.toString()}`, {
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
