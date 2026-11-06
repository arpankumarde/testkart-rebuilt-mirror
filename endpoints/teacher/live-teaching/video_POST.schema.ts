import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  /** Null removes the saved video. */
  introVideoUrl: z.string().url().nullable(),
  introVideoFileId: z.string().nullable().optional(),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export const postTeacherLiveTeachingVideo = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/live-teaching/video`, {
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