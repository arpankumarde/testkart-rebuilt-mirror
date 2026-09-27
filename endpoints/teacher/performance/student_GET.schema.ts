import { z } from "zod";
import superjson from "superjson";
import type { NoteReadingStatus } from "../../../helpers/teacherPerformance";

export const schema = z.object({
  studentId: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

/**
 * One test-series paper the student has opened. bestScore and rank use the
 * public leaderboard's rule: each student's best finished attempt, ranked by
 * score then time taken. Scores are percentages.
 */
export type StudentPaperResult = {
  itemId: number;
  paperTitle: string;
  seriesId: number;
  seriesTitle: string;
  inTrash: boolean;
  removed: boolean;
  attempts: number;
  finished: number;
  firstScore: number | null;
  bestScore: number | null;
  latestScore: number | null;
  timeTakenMinutes: number | null;
  rank: number | null;
  rankedOf: number | null;
  lastAttemptAt: Date | null;
};

/** Ranked as the live leaderboard and prize payout rank: first in-window attempt only. */
export type StudentLiveResult = {
  liveTestId: number;
  title: string;
  startTime: Date | null;
  endTime: Date;
  status: "upcoming" | "live" | "ended";
  rank: number | null;
  rankedOf: number;
  score: number | null;
  timeTakenMinutes: number | null;
};

export type StudentCourseProgress = {
  courseId: number;
  title: string;
  enrolledAt: Date | null;
  lessonsDone: number;
  lessonsTotal: number;
  progress: number;
  status: "not_started" | "in_progress" | "completed";
  lastLessonAt: Date | null;
};

export type StudentEnrolment = {
  kind: "test_series" | "course" | "live_test" | "bundle" | "study_notes";
  title: string;
  enrolledAt: Date | null;
};

/** Pages opened in the web reader against the note's page count. */
export type StudentNoteReading = {
  productId: number;
  title: string;
  boughtAt: Date | null;
  pagesRead: number;
  pagesTotal: number;
  progress: number;
  status: NoteReadingStatus;
  lastOpenedAt: Date | null;
};

export type OutputType = {
  student: { id: number; name: string; avatarUrl: string | null };
  papers: StudentPaperResult[];
  liveTests: StudentLiveResult[];
  courses: StudentCourseProgress[];
  notes: StudentNoteReading[];
  enrolments: StudentEnrolment[];
};

export const getTeacherPerformanceStudent = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ studentId: String(query.studentId) });
  const result = await fetch(`/_api/teacher/performance/student?${params.toString()}`, {
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
