import { z } from "zod";
import superjson from "superjson";

const id = z.coerce.number().int().positive().optional();

/** At most one scope: the roster of one test series, live test, course or study note. */
export const schema = z
  .object({ seriesId: id, liveTestId: id, courseId: id, productId: id })
  .refine((v) => [v.seriesId, v.liveTestId, v.courseId, v.productId].filter((x) => x !== undefined).length <= 1, {
    message: "Pick one test series, live test, course or study note",
  });

export type InputType = z.infer<typeof schema>;

export type PerformanceScope = { kind: "series" | "live_test" | "course" | "note"; id: number; title: string };

/**
 * One row per student who enrolled in, bought, or attempted the teacher's
 * content. Scores are percentages from each student's best finished attempt
 * per paper; course progress is lessons done against the course's current
 * lesson count; note progress is pages opened in the web reader against the
 * notes' page count.
 */
export type PerformanceStudentRow = {
  studentId: number;
  name: string;
  avatarUrl: string | null;
  enrolments: number;
  firstEnrolledAt: Date | null;
  papersStarted: number;
  papersFinished: number;
  averageScore: number | null;
  bestScore: number | null;
  courses: number;
  lessonsDone: number;
  courseProgress: number | null;
  notes: number;
  notePagesRead: number;
  noteProgress: number | null;
  lastActiveAt: Date | null;
};

export type OutputType = {
  generatedAt: Date;
  scope: PerformanceScope | null;
  totals: {
    students: number;
    testTakers: number;
    papersFinished: number;
    averageScore: number | null;
    courseLearners: number;
    averageProgress: number | null;
    noteOwners: number;
    noteReaders: number;
    averageNoteProgress: number | null;
  };
  students: PerformanceStudentRow[];
};

export const getTeacherPerformanceStudents = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (query.seriesId) params.set("seriesId", String(query.seriesId));
  if (query.liveTestId) params.set("liveTestId", String(query.liveTestId));
  if (query.courseId) params.set("courseId", String(query.courseId));
  if (query.productId) params.set("productId", String(query.productId));
  const result = await fetch(`/_api/teacher/performance/students?${params.toString()}`, {
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
