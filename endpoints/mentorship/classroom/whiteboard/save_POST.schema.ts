import { z } from "zod";
import superjson from "superjson";
import type { WbOp } from "../../../../helpers/classroomWhiteboardTypes";

const opSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum(["pen", "highlighter", "eraser", "line", "rect", "ellipse", "text"]),
  })
  .passthrough();

export const schema = z.object({
  kind: z.enum(["booking", "group"]),
  id: z.string().uuid(),
  /** The whole board, replacing what was saved; an empty list after Clear. */
  ops: z.array(opSchema).max(20000),
});
export type InputType = { kind: "booking" | "group"; id: string; ops: WbOp[] };

export type OutputType = { ok: true; updatedAt: Date };

export const postMentorshipClassroomWhiteboardSave = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/classroom/whiteboard/save`, {
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
