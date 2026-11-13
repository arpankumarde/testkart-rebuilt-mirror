import { z } from "zod";
import superjson from "superjson";
import { LIVE_COURSE_CLASS_MAX_MINUTES, LIVE_COURSE_CLASS_MIN_MINUTES } from "../../../../helpers/liveCourseRules";

const minutes = z.number().int().min(LIVE_COURSE_CLASS_MIN_MINUTES).max(LIVE_COURSE_CLASS_MAX_MINUTES);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const hm = z.string().regex(/^\d{2}:\d{2}$/, "Pick a time");

export const schema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("single"),
    liveCourseId: z.string().uuid(),
    title: z.string().trim().min(1, "Give the class a name").max(200),
    startTime: z.coerce.date(),
    durationMinutes: minutes,
    topicId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    mode: z.literal("pattern"),
    liveCourseId: z.string().uuid(),
    titlePrefix: z.string().trim().min(1).max(150).default("Class"),
    fromDate: ymd,
    toDate: ymd,
    weekdays: z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one day"),
    time: hm,
    durationMinutes: minutes,
  }),
]);

export type InputType = z.input<typeof schema>;
export type OutputType = { added: number };

export const postTeacherLiveCourseClassesAdd = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/live-courses/classes/add`, {
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
