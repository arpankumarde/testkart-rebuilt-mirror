import { z } from "zod";
import superjson from "superjson";

/**
 * Books several of a package's paid classes in one go, e.g. "every Monday at 10:00" for 4 weeks.
 * Each time takes the next class waiting for a time; a time that is no longer free is skipped and
 * reported back, and its class keeps waiting.
 */
export const schema = z.object({
  packageId: z.string().uuid(),
  startTimes: z.array(z.coerce.date()).min(1).max(24),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = {
  booked: Date[];
  skipped: { startTime: Date; reason: string }[];
  /** Paid classes of this package still waiting for a time. */
  waiting: number;
};

export const postMentorshipCreditScheduleMany = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/mentorship/credits/schedule-many`, {
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