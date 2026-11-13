import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ liveCourseId: z.string().uuid() });
export type InputType = z.infer<typeof schema>;

export type LiveCourseRosterRow = {
  enrollmentId: string;
  studentId: number;
  name: string;
  avatarUrl: string | null;
  email: string | null;
  status: "enrolled" | "refunded" | "removed";
  amountPaid: number;
  enrolledAt: Date;
  refundedAt: Date | null;
  refundStatus: string | null;
};

export type AttendanceMark = { classId: string; studentId: number; present: boolean; source: "auto" | "teacher" };

export type OutputType = {
  students: LiveCourseRosterRow[];
  /** Classes that have started, oldest first; attendance is kept for these. */
  classes: { id: string; title: string; startTime: Date; status: string }[];
  attendance: AttendanceMark[];
};

export const getTeacherLiveCourseStudents = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ liveCourseId: input.liveCourseId });
  const result = await fetch(`/_api/teacher/live-courses/students?${params.toString()}`, {
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
