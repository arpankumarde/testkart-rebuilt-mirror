import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  /** "upcoming" (default) = enrolled and not yet started; "past" = completed/started/ended; "cancelled"; "all". */
  filter: z.enum(["upcoming", "past", "cancelled", "all"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
export type InputType = z.infer<typeof schema>;

export type MyGroupLessonEnrollmentRow = {
  enrollmentId: number;
  status: string;
  groupLessonId: number;
  title: string;
  subject: string | null;
  startTime: Date;
  durationMinutes: number;
  amountPaid: number;
  lessonStatus: string;
  teacherId: number;
  teacherName: string;
  teacherAvatarUrl: string | null;
  removedByTeacher: boolean;
};

export type OutputType = { enrollments: MyGroupLessonEnrollmentRow[] };

export const getMentorshipMyGroupLessonEnrollments = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.filter) params.set("filter", input.filter);
  if (input.limit) params.set("limit", String(input.limit));
  const result = await fetch(`/_api/mentorship/group-lessons/my-enrollments?${params.toString()}`, {
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
