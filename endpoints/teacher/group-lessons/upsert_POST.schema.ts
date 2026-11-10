import { z } from "zod";
import superjson from "superjson";
import { GROUP_LESSON_MIN_CAPACITY, GROUP_LESSON_MAX_CAPACITY, BOOKING_MIN_NOTICE_MINUTES } from "../../../helpers/liveLessonConfig";

export const schema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(3, "Title is required").max(200),
    description: z.string().trim().max(5000).optional(),
    subject: z.string().trim().max(120).optional(),
    level: z.string().trim().max(60).optional(),
    language: z.string().trim().max(60).optional(),
    startTime: z.coerce.date(),
    durationMinutes: z.number().int().min(15).max(240),
    pricePerLearner: z.number().min(0),
    maxCapacity: z.number().int().min(GROUP_LESSON_MIN_CAPACITY).max(GROUP_LESSON_MAX_CAPACITY),
    minEnrollment: z.number().int().positive().optional(),
    minEnrollmentPolicy: z.enum(["run_anyway", "cancel_if_not_met"]).default("run_anyway"),
    coverImageUrl: z.string().optional(),
    coverImageFileId: z.string().optional(),
  })
  .refine((v) => v.startTime.getTime() > Date.now() + BOOKING_MIN_NOTICE_MINUTES * 60000, {
    message: `Start time must be at least ${BOOKING_MIN_NOTICE_MINUTES} minutes from now`,
    path: ["startTime"],
  })
  .refine((v) => !v.minEnrollment || v.minEnrollment <= v.maxCapacity, {
    message: "Minimum enrollment can't exceed max capacity",
    path: ["minEnrollment"],
  });

export type InputType = z.infer<typeof schema>;
export type OutputType = { id: string };

export const postTeacherGroupLessonUpsert = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/group-lessons/upsert`, {
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
