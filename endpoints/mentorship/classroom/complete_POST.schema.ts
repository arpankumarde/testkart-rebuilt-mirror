import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  kind: z.enum(["booking", "group"]),
  id: z.string().uuid(),
  /** Only meaningful for a 1:1 booking, where no_show means the learner did not attend. Defaults to "completed". */
  outcome: z.enum(["completed", "no_show"]).optional(),
});
export type InputType = z.infer<typeof schema>;
/** changed is false when the session already had an outcome, so a repeated click does nothing. */
export type OutputType = { success: true; status: string; changed: boolean };

export const postMentorshipClassroomComplete = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/classroom/complete`, {
    method: "POST",
    body: superjson.stringify(input),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
