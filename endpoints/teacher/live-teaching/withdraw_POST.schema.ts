import { z } from "zod";
import superjson from "superjson";

/**
 * application: pulls back an application that is still in review; the teacher can apply again.
 * video: cancels an approved teacher's replacement video that is waiting for review.
 */
export const schema = z.object({ what: z.enum(["application", "video"]) });
export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export const postTeacherLiveTeachingWithdraw = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/live-teaching/withdraw`, {
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
