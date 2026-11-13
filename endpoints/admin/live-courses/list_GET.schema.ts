import { z } from "zod";
import superjson from "superjson";
import type { LiveCourseSummary } from "../../../helpers/liveCourseData";

export const schema = z.object({
  status: z.enum(["all", "draft", "published", "cancelled", "completed"]).default("all"),
  q: z.string().trim().max(100).optional(),
});
export type InputType = z.input<typeof schema>;

export type OutputType = { courses: (LiveCourseSummary & { revenue: number; refunds: number })[] };

export const getAdminLiveCourses = async (input: InputType = {}, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.q) params.set("q", input.q);
  const result = await fetch(`/_api/admin/live-lessons/courses/list?${params.toString()}`, {
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
