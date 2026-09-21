import { z } from "zod";
import superjson from "superjson";
import { AnalyticsRangeValues, AnalyticsRange, AnalyticsBucket } from "../../../helpers/teacherAnalyticsTime";

export const schema = z.object({
  range: z.enum(AnalyticsRangeValues).default("30d"),
});

export type InputType = z.infer<typeof schema>;

/**
 * New enrolments (test series, live tests, courses and bundles, as on
 * Overview) and distinct students who started a paper or finished a lesson.
 */
export type AnalyticsStudentPoint = {
  bucket: string;
  enrolments: number;
  activeLearners: number;
};

/** All time: progress builds up over months, so a window would only show recent starters. */
export type AnalyticsCourseCompletion = {
  id: number;
  title: string;
  enrolments: number;
  completed: number;
  averageProgress: number;
};

/**
 * Papers started in the range, counted once per student and paper so attempt
 * rows duplicated by a reload do not inflate them. scores holds ten buckets of
 * each student's first finished attempt (0-9 ... 90-100 percent); belowZero
 * counts negative-marking results.
 */
export type AnalyticsSeriesFinish = {
  kind: "mock_test" | "live_test";
  id: number;
  title: string;
  started: number;
  finished: number;
  scores: number[];
  belowZero: number;
};

export type OutputType = {
  range: AnalyticsRange;
  bucket: AnalyticsBucket;
  generatedAt: Date;
  totals: {
    enrolments: number;
    activeLearners: number;
    /** Students with a paid order in the range. */
    buyers: number;
    /** Of those, students with two or more paid orders from this teacher, ever. */
    repeatBuyers: number;
  };
  series: AnalyticsStudentPoint[];
  courses: AnalyticsCourseCompletion[];
  testSeries: AnalyticsSeriesFinish[];
};

export const getTeacherAnalyticsStudents = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ range: query.range });
  const result = await fetch(`/_api/teacher/analytics/students?${params.toString()}`, {
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