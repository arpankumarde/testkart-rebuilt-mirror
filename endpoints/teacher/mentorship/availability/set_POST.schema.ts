import { z } from "zod";
import superjson from "superjson";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export const windowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex, "Use HH:MM"),
    endTime: z.string().regex(timeRegex, "Use HH:MM"),
    isActive: z.boolean().default(true),
  })
  .refine((w) => w.startTime < w.endTime, { message: "End time must be after start time" });

export const schema = z.object({
  timezone: z.string().trim().min(1).max(64),
  windows: z.array(windowSchema).max(100),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export const postTeacherMentorshipAvailabilitySet = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/mentorship/availability/set`, {
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
