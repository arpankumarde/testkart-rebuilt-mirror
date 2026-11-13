import { z } from "zod";
import superjson from "superjson";
import type { LiveCourseModule } from "../../../helpers/liveCourseData";

const topic = z.object({ id: z.string().uuid().optional(), title: z.string().trim().min(1, "Topic needs a name").max(200) });
const moduleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Module needs a name").max(200),
  topics: z.array(topic).max(100),
});

export const schema = z.object({
  liveCourseId: z.string().uuid(),
  modules: z.array(moduleSchema).max(60),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { modules: LiveCourseModule[] };

export const postTeacherLiveCourseSyllabus = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/live-courses/syllabus`, {
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
