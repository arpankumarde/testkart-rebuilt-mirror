import { z } from "zod";
import superjson from "superjson";
import type { LiveCourseDetail } from "../../../helpers/liveCourseData";

export const schema = z.object({ id: z.string().uuid() });
export type InputType = z.infer<typeof schema>;

/**
 * What the teacher earns: per held class per student (the price split over the course's min
 * classes, less the fee) and per student over the course. `fixed` once published; before that it
 * follows the classes in the timetable. cancelRefundPerStudent: what each enrolled student would get
 * back if one more class were cancelled (0 while the course can spare it).
 */
export type LiveCourseEarningsPreview = {
  platformFeePercentage: number;
  perClassPerStudent: number;
  perStudent: number;
  fixed: boolean;
  cancelRefundPerStudent: number;
};

export type OutputType = { course: LiveCourseDetail; refundClosesAt: Date | null; earnings: LiveCourseEarningsPreview };

export const getTeacherLiveCourse = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ id: input.id });
  const result = await fetch(`/_api/teacher/live-courses/get?${params.toString()}`, {
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
