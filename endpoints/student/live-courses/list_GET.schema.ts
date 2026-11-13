import { z } from "zod";
import superjson from "superjson";
import type { LiveCourseSummary } from "../../../helpers/liveCourseData";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;

export type MyLiveCourse = LiveCourseSummary & {
  enrollmentStatus: "enrolled" | "refunded" | "removed";
  enrolledAt: Date;
  classesHeld: number;
  classesAttended: number;
  nextClass: { id: string; title: string; startTime: Date; durationMinutes: number } | null;
};

export type TimetableEntry = {
  classId: string;
  title: string;
  startTime: Date;
  durationMinutes: number;
  courseId: string;
  courseTitle: string;
  teacherName: string;
};

export type OutputType = {
  courses: MyLiveCourse[];
  /** Upcoming and live classes of active enrolments over the next 14 days, soonest first. */
  timetable: TimetableEntry[];
};

export const getStudentLiveCourses = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/student/live-courses/list`, {
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
