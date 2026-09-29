import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Courses } from "../../../helpers/schema";
import type { ContentExam } from "../../../helpers/contentExams";
import type { ContentRejection } from "../../../helpers/contentReviewStatus";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type TeacherCourseListItem = Omit<Selectable<Courses>, "price" | "discountPrice"> & {
  price: number;
  discountPrice: number | null;
  sectionsCount: number;
  lessonsCount: number;
  /** Every exam the course is listed under, primary first. */
  exams: ContentExam[];
  /** Submitted for publishing and waiting on admin approval. */
  inReview: boolean;
  /** Set when the latest review was rejected, with the admin's reason. */
  rejection: ContentRejection | null;
};

export type OutputType = TeacherCourseListItem[];

export const getTeacherCoursesList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/courses/list`, {
    method: "GET",
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};