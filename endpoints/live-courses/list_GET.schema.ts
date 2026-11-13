import { z } from "zod";
import superjson from "superjson";
import type { LiveCourseSummary } from "../../helpers/liveCourseData";

export const schema = z.object({
  examId: z.coerce.number().int().positive().optional(),
  examSlug: z.string().trim().max(200).optional(),
  teacherId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});
export type InputType = z.input<typeof schema>;

export type OutputType = { courses: LiveCourseSummary[] };

export const getLiveCourses = async (input: InputType = {}, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) if (v !== undefined && v !== "") params.set(k, String(v));
  const result = await fetch(`/_api/live-courses/list?${params.toString()}`, {
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
