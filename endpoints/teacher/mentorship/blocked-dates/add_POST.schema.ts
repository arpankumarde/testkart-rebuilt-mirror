import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  blockedDate: z.coerce.date(),
  reason: z.string().trim().max(200).optional(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { id: number };

export const postTeacherMentorshipBlockedDateAdd = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/mentorship/blocked-dates/add`, {
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
