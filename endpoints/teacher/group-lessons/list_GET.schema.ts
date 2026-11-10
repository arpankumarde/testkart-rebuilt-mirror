import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;

export type TeacherGroupLessonRow = {
  id: string;
  title: string;
  subject: string | null;
  level: string | null;
  language: string | null;
  startTime: Date;
  durationMinutes: number;
  pricePerLearner: number;
  maxCapacity: number;
  enrolledCount: number;
  minEnrollment: number | null;
  minEnrollmentPolicy: string;
  status: string;
  coverImageUrl: string | null;
  cancellationReason: string | null;
};

export type OutputType = { groupLessons: TeacherGroupLessonRow[] };

export const getTeacherGroupLessonsList = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/group-lessons/list`, {
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
