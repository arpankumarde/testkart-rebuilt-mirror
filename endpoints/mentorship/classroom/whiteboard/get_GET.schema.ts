import { z } from "zod";
import superjson from "superjson";
import type { WbOp } from "../../../../helpers/classroomWhiteboardTypes";

export const schema = z.object({
  kind: z.enum(["booking", "group"]),
  id: z.string().uuid(),
});
export type InputType = z.infer<typeof schema>;

/** The class's saved whiteboard; an empty list when the teacher never drew on it. */
export type OutputType = { ops: WbOp[]; updatedAt: Date | null };

export const getMentorshipClassroomWhiteboard = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ kind: input.kind, id: String(input.id) });
  const result = await fetch(`/_api/mentorship/classroom/whiteboard/get?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
