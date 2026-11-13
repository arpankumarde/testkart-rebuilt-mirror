import { z } from "zod";
import superjson from "superjson";
import type { LiveCourseDetail } from "../../../helpers/liveCourseData";

export const schema = z.object({ id: z.string().uuid() });
export type InputType = z.infer<typeof schema>;

export type OutputType = { course: LiveCourseDetail; refundClosesAt: Date | null };

export const getTeacherLiveCourse = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ id: input.id });
  const result = await fetch(`/_api/teacher/live-courses/get?${params.toString()}`, {
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
