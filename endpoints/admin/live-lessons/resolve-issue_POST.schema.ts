import { z } from "zod";
import superjson from "superjson";

/**
 * Settles a student's "teacher did not come" report. refunded: the class is given back (a package
 * class waits for a new time, a trial's price goes to the live class balance) and the teacher is
 * not paid. rejected: the class stands and the teacher is paid.
 */
export const schema = z.object({
  bookingId: z.string().uuid(),
  resolution: z.enum(["refunded", "rejected"]),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export const postAdminResolveLiveIssue = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/live-lessons/resolve-issue`, {
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
