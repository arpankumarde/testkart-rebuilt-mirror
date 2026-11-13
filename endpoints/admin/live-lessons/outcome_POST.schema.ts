import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  kind: z.literal("booking"),
  id: z.string().uuid(),
  /** complete: the teacher held it. missed: the teacher did not. Learner attendance is set separately. */
  action: z.enum(["complete", "missed"]),
  reason: z.string().trim().max(500).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  status: "completed" | "missed";
  /** False when the session already had this outcome, so nothing changed. */
  changed: boolean;
  /** Set when a missed 1:1 class handed its credit back to the learner. */
  creditReturned: "unscheduled" | "released" | null;
};

export const postAdminLiveOutcome = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/live-lessons/outcome`, {
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