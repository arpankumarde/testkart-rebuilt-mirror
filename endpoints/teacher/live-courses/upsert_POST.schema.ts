import { z } from "zod";
import superjson from "superjson";
import {
  LIVE_COURSE_CLASS_MAX_MINUTES,
  LIVE_COURSE_CLASS_MIN_MINUTES,
  LIVE_COURSE_LEVELS,
  LIVE_COURSE_SEAT_LIMIT_MAX,
} from "../../../helpers/liveCourseRules";

export const schema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(5, "Add a title of at least 5 characters").max(200),
    description: z.string().trim().max(20000).default(""),
    thumbnailUrl: z.string().trim().max(2000).nullable().optional(),
    thumbnailFileId: z.string().trim().max(500).nullable().optional(),
    examId: z.number().int().positive().nullable().optional(),
    languages: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    level: z.enum(LIVE_COURSE_LEVELS).default("beginner"),
    price: z.number().positive("Live courses cannot be free").max(500000),
    originalPrice: z.number().positive().max(500000).nullable().optional(),
    seatLimit: z.number().int().min(1).max(LIVE_COURSE_SEAT_LIMIT_MAX, `At most ${LIVE_COURSE_SEAT_LIMIT_MAX} seats`),
    registrationDeadline: z.coerce.date().nullable().optional(),
    defaultClassMinutes: z.number().int().min(LIVE_COURSE_CLASS_MIN_MINUTES).max(LIVE_COURSE_CLASS_MAX_MINUTES),
  })
  .refine((v) => v.originalPrice == null || v.originalPrice > v.price, {
    message: "The original price must be higher than the price",
    path: ["originalPrice"],
  });

export type InputType = z.input<typeof schema>;
export type OutputType = { id: string; slug: string };

export const postTeacherLiveCourseUpsert = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/live-courses/upsert`, {
    method: "POST",
    body: superjson.stringify(schema.parse(input)),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
