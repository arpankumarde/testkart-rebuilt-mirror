import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  classId: z.string().uuid(),
  marks: z.array(z.object({ studentId: z.number().int().positive(), present: z.boolean() })).min(1).max(100),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { saved: number };

export const postTeacherLiveCourseAttendance = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/live-courses/attendance`, {
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
