import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  teacherId: z.coerce.number().int().positive().optional(),
  subject: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
export type InputType = z.infer<typeof schema>;

export type GroupLessonListRow = {
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
  coverImageUrl: string | null;
  teacherId: number;
  teacherName: string;
  teacherAvatarUrl: string | null;
};

export type OutputType = { groupLessons: GroupLessonListRow[] };

export const getMentorshipGroupLessonsList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.teacherId) params.set("teacherId", String(input.teacherId));
  if (input.subject) params.set("subject", input.subject);
  if (input.limit) params.set("limit", String(input.limit));
  const result = await fetch(`/_api/mentorship/group-lessons/list?${params.toString()}`, {
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
