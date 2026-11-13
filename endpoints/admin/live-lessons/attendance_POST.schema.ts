import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  /** A 1:1 booking id. Live course attendance is set on the Live courses admin page. */
  type: z.literal("booking"),
  id: z.string().uuid(),
  attendance: z.enum(["attended", "missed"]),
  reason: z.string().trim().max(500).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { changed: boolean };

export const postAdminLiveAttendance = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/live-lessons/attendance`, {
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