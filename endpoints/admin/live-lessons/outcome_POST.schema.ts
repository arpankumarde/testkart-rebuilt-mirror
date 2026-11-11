import { z } from "zod";
import superjson from "superjson";

export const schema = z
  .object({
    kind: z.enum(["booking", "group"]),
    id: z.string().uuid(),
    action: z.enum(["complete", "no_show"]),
    /** Who did not attend; required for a no-show. */
    party: z.enum(["teacher", "learner"]).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.action !== "no_show" || v.kind === "booking", { message: "Only a 1:1 session can be marked a no-show." })
  .refine((v) => v.action !== "no_show" || !!v.party, { message: "Say who did not attend." });

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  status: "completed" | "no_show";
  /** False when the session already had this outcome, so nothing changed. */
  changed: boolean;
  /** Set when a teacher no-show handed a credit back to the learner. */
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