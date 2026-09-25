import { z } from "zod";
import superjson from "superjson";
import { CourseListItem } from "./list_GET.schema";

export const schema = z.object({
  courseId: z.number().int().positive(),
  limit: z.number().int().min(1).max(10).default(4).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  courses: CourseListItem[];
};

export const getRelatedCourses = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  queryParams.set("courseId", params.courseId.toString());
  if (params.limit !== undefined) {
    queryParams.set("limit", params.limit.toString());
  }

  const result = await fetch(`/_api/courses/related?${queryParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};