import { z } from "zod";
import superjson from "superjson";

/** Package settings a student can change: autopay renewal, and classes per week from the next cycle. */
export const schema = z.object({
  packageId: z.string().uuid(),
  autoRenew: z.boolean().optional(),
  nextClassesPerWeek: z.number().int().min(1).max(6).optional(),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export const postMentorshipPackageUpdate = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/packages/update`, {
    method: "POST",
    body: superjson.stringify(schema.parse(body)),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
