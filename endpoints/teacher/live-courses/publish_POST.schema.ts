import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  liveCourseId: z.string().uuid(),
  action: z.enum(["publish", "unpublish"]),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { status: "draft" | "published"; slug: string };

export const postTeacherLiveCoursePublish = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/live-courses/publish`, {
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
