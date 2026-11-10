import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ id: z.string().uuid() });
export type InputType = z.infer<typeof schema>;

export type GroupLessonDetail = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  level: string | null;
  language: string | null;
  startTime: Date;
  durationMinutes: number;
  pricePerLearner: number;
  maxCapacity: number;
  enrolledCount: number;
  status: string;
  coverImageUrl: string | null;
  teacherId: number;
  teacherName: string;
  teacherAvatarUrl: string | null;
  teacherBio: string | null;
  /** The viewer's own enrollment status, if signed in; null if not enrolled or not signed in. */
  viewerEnrollmentStatus: "enrolled" | "cancelled" | "removed" | null;
};

export type OutputType = { groupLesson: GroupLessonDetail };

export const getMentorshipGroupLesson = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ id: String(input.id) });
  const result = await fetch(`/_api/mentorship/group-lessons/get?${params.toString()}`, {
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
