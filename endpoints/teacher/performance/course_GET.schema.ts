import { z } from "zod";
import superjson from "superjson";

/** No courseId picks the course with the most enrolments. */
export const schema = z.object({
  courseId: z.coerce.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type CourseOption = { id: number; title: string; status: string; enrolled: number; lessons: number };

export type CourseProgressStatus = "not_started" | "in_progress" | "completed";

/** Progress is lessons done against the course's lessons as they stand today. */
export type CourseStudentRow = {
  studentId: number;
  name: string;
  avatarUrl: string | null;
  enrolledAt: Date | null;
  lessonsDone: number;
  lessonsTotal: number;
  progress: number;
  status: CourseProgressStatus;
  lastLessonAt: Date | null;
};

export type OutputType = {
  courses: CourseOption[];
  course: {
    id: number;
    title: string;
    lessons: number;
    totals: { enrolled: number; started: number; completed: number; averageProgress: number | null };
    rows: CourseStudentRow[];
  } | null;
};

export const getTeacherPerformanceCourse = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (query.courseId) params.set("courseId", String(query.courseId));
  const result = await fetch(`/_api/teacher/performance/course?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
