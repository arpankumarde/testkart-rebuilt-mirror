import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  teacherId: z.coerce.number().int().positive(),
  /** 25 or 50 minutes - see MENTORSHIP_SESSION_DURATIONS. */
  durationMinutes: z.coerce.number().int().positive(),
  /** Inclusive range start, ISO date or datetime. Defaults to now. */
  from: z.coerce.date().optional(),
  /** Inclusive range end. Bounded to at most 35 days after `from`. */
  to: z.coerce.date().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  teacherTimezone: string;
  durationMinutes: number;
  slots: { startTime: Date; endTime: Date }[];
};

export const getMentorshipSlots = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  params.set("teacherId", String(input.teacherId));
  params.set("durationMinutes", String(input.durationMinutes));
  if (input.from) params.set("from", input.from.toISOString());
  if (input.to) params.set("to", input.to.toISOString());
  const result = await fetch(`/_api/mentorship/slots?${params.toString()}`, {
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
