import { z } from "zod";
import superjson from "superjson";
import { LIVE_COURSE_CLASS_MAX_MINUTES, LIVE_COURSE_CLASS_MIN_MINUTES } from "../../../../helpers/liveCourseRules";

export const schema = z.object({
  classId: z.string().uuid(),
  title: z.string().trim().min(1, "Give the class a name").max(200),
  startTime: z.coerce.date(),
  durationMinutes: z.number().int().min(LIVE_COURSE_CLASS_MIN_MINUTES).max(LIVE_COURSE_CLASS_MAX_MINUTES),
  topicId: z.string().uuid().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true; rescheduled: boolean };

export const postTeacherLiveCourseClassUpdate = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/live-courses/classes/update`, {
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
